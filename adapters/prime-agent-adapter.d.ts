import type { TmuxAdapter } from "./tmux.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
export interface PrimeAgentFsOps {
    readFile(path: string): string;
    exists(path: string): boolean;
    mkdirp?(path: string): void;
    copyFile?(src: string, dest: string): void;
    readdir?(dir: string): string[];
}
export declare class PrimeAgentAdapter implements RuntimeAdapter {
    readonly runtime = "prime-agent";
    private readonly tmux;
    private readonly seatLaunchEnvironment;
    private readonly fsOps;
    constructor(opts: {
        tmux: TmuxAdapter;
        seatLaunchEnvironment?: unknown;
        fsOps: PrimeAgentFsOps;
    });
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding, sendInteractiveText?: (text: string) => Promise<void>): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        resumeToken?: string;
        forkSource?: unknown;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
}
