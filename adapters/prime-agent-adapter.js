import { execFileSync } from "node:child_process";
import * as nodePath from "node:path";
import * as os from "node:os";
import { resolveConcreteHint, } from "../domain/runtime-adapter.js";
import { shellQuote } from "./shell-quote.js";

/**
 * Prime Agent runtime adapter.
 * Launches prime-agent REPL sessions in tmux, delivers guidance via send_text,
 * and uses the workspace AGENTS.md + .prime/ skill tree for projection (no-op).
 */
export class PrimeAgentAdapter {
    /** @param {{ tmux: any, seatLaunchEnvironment?: any, fsOps: { readFile(path: string): string; exists(path: string): boolean; mkdirp?(path: string): void; copyFile?(src: string, dest: string): void; readdir?(dir: string): string[]; } }} opts */
    tmux;
    seatLaunchEnvironment;
    fsOps;
    runtime = "prime-agent";
    constructor(opts) {
        this.tmux = opts.tmux;
        this.seatLaunchEnvironment = opts.seatLaunchEnvironment;
        this.fsOps = opts.fsOps;
    }
    async listInstalled(binding) {
        const skillsDir = nodePath.join(binding.cwd, ".agents", "skills");
        const installed = [];
        try {
            const entries = this.fsOps.readdir ? this.fsOps.readdir(skillsDir) : [];
            for (const e of entries) {
                const skillPath = nodePath.join(skillsDir, e, "SKILL.md");
                if (this.fsOps.exists(skillPath)) {
                    installed.push({ effectiveId: e, category: "skill", installedPath: skillPath });
                }
            }
        }
        catch {}
        return installed;
    }
    async project(plan, binding) {
        // prime-agent reads skills from .agents/skills/ in cwd (projected by OpenRig workspace layer).
        // This adapter is a no-op: acknowledge all entries to avoid projection-failed warnings.
        const projected = [];
        const failed = [];
        for (const e of plan.entries ?? []) {
            const target = nodePath.join(binding.cwd, ".agents", "skills", e.effectiveId, "SKILL.md");
            if (this.fsOps.exists(target)) projected.push(e.effectiveId);
            else failed.push({ effectiveId: e.effectiveId, error: `skill not materialized at runtime target: ${target}` });
        }
        return { projected, skipped: [], failed };
    }
    async deliverStartup(files, binding, sendInteractiveText) {
        let delivered = 0;
        const failed = [];
        const warnings = [];
        for (const file of files) {
            const hint = file.deliveryHint === "auto" ? resolveConcreteHint(file.path, "") : file.deliveryHint;
            try {
                let content;
                try {
                    content = this.fsOps.readFile(file.absolutePath);
                }
                catch {
                    if (file.required) {
                        failed.push({ path: file.path, error: `cannot read ${file.absolutePath}` });
                        continue;
                    }
                    warnings.push(`skipped optional ${file.path}: unreadable`);
                    continue;
                }
                if (hint === "send_text") {
                    if (!sendInteractiveText) {
                        if (file.required) {
                            failed.push({ path: file.path, error: "no interactive channel available" });
                        } else {
                            warnings.push(`optional ${file.path}: no interactive channel available`);
                        }
                        continue;
                    }
                    await sendInteractiveText(content);
                    delivered++;
                }
                else {
                    // guidance_merge / skill_install: prime-agent reads these from disk on its own.
                    // Deliver the absolute path so the agent can resolve files outside binding.cwd.
                    if (sendInteractiveText) {
                        await sendInteractiveText(`Read ${file.absolutePath} before doing anything else.`);
                    }
                    delivered++;
                }
            }
            catch (err) {
                if (file.required) {
                    failed.push({ path: file.path, error: err.message });
                }
                else {
                    warnings.push(`optional ${file.path} failed: ${err.message}`);
                }
            }
        }
        return { delivered, failed, warnings };
    }
    async launchHarness(binding, opts) {
        if (opts.forkSource) {
            return { ok: false, error: `prime-agent: fork is not supported in v1; use --resume via terminal` };
        }
        if (opts.resumeToken) {
            return { ok: false, error: `prime-agent: native resume tokens are not captured in v1; seat relaunches fresh` };
        }
        const model = binding.model?.trim();
        const effort = binding.effort?.trim();
        const modelArg = model ? ` --model ${shellQuote(model)}` : "";
        const effortArg = effort ? ` --thinking ${shellQuote(effort)}` : "";
        const cmd = `prime-agent --thinking low${modelArg}${effortArg}`;
        try {
            const textResult = await this.tmux.sendText(binding.tmuxSession, cmd);
            if (!textResult.ok) {
                return { ok: false, error: `Failed to send launch text: ${textResult.message}` };
            }
            const enterResult = await this.tmux.sendKeys(binding.tmuxSession, ["Enter"]);
            if (!enterResult.ok) {
                return { ok: false, error: `Failed to press Enter: ${enterResult.message}` };
            }
        }
        catch (err) {
            return { ok: false, error: `Launch failed: ${err.message}` };
        }
        return { ok: true };
    }
    async checkReady(binding) {
        try {
            const content = (await this.tmux.capturePaneContent(binding.tmuxSession, 40)) ?? "";
            if (!content) {
                return { ready: false, reason: "pane is empty", code: "pane_empty" };
            }
            // Only TUI-specific signals count as ready. The echoed launch command
            // (e.g. `prime-agent --thinking low`) is stripped from consideration so a
            // failed/exited launch can never satisfy readiness.
            const lines = content.split("\n").filter((l) => !l.includes("prime-agent --"));
            const pane = lines.join("\n");
            if (pane.includes("\u2190 manage") || /\u00b7\s*\d+%/.test(pane)) {
                return { ready: true };
            }
            // Shell prompt = agent not launched yet
            if (content.includes("$") || content.includes("%") || content.includes(">")) {
                return { ready: false, reason: "shell prompt visible; agent not launched", code: "not_launched" };
            }
            return { ready: false, reason: "unknown pane state", code: "unknown" };
        }
        catch (err) {
            return { ready: false, reason: err.message, code: "pane_error" };
        }
    }
}
