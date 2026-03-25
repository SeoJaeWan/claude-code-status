/**
 * config.ts
 *
 * Reads and writes the user configuration file at
 * ${CLAUDE_PLUGIN_DATA}/config.json.
 *
 * Currently supports toggling service visibility in the status line.
 */
export interface ServiceVisibility {
    gmail?: boolean;
    tasks?: boolean;
    jira?: boolean;
    github?: boolean;
}
export interface PluginConfig {
    services?: ServiceVisibility;
}
type ExternalService = keyof ServiceVisibility;
/**
 * Reads the config file. Returns an empty object if it doesn't exist or is
 * invalid JSON — missing config is never an error.
 */
export declare function readConfig(): PluginConfig;
/**
 * Writes the config file, merging with existing values.
 */
export declare function writeConfig(patch: PluginConfig): void;
/**
 * Returns true if the given service should be displayed.
 * Defaults to true when no config exists or the service is not mentioned.
 */
export declare function isServiceEnabled(service: ExternalService): boolean;
export {};
//# sourceMappingURL=config.d.ts.map