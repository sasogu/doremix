
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const VSCODE_CWD: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const E_CONF_PROFILE: string;
	export const USER: string;
	export const CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
	export const VSCODE_NLS_CONFIG: string;
	export const npm_config_user_agent: string;
	export const E_ICON_THEME: string;
	export const XDG_SEAT: string;
	export const MOKSHA_PKEXEC: string;
	export const ELM_CONFIG_DIR_XDG: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const SSH_AGENT_PID: string;
	export const XDG_SESSION_TYPE: string;
	export const npm_node_execpath: string;
	export const SHLVL: string;
	export const npm_config_noproxy: string;
	export const IBUS_NO_SNOOPER_APPS: string;
	export const HOME: string;
	export const CHROME_DESKTOP: string;
	export const E_LIB_DIR: string;
	export const DESKTOP_SESSION: string;
	export const npm_package_json: string;
	export const QT_STYLE_OVERRIDE: string;
	export const VSCODE_IPC_HOOK: string;
	export const GIO_LAUNCHED_DESKTOP_FILE: string;
	export const GTK_MODULES: string;
	export const XDG_SEAT_PATH: string;
	export const E_BIN_DIR: string;
	export const npm_config_userconfig: string;
	export const npm_config_local_prefix: string;
	export const E_HOME_DIR: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const E_IPC_SOCKET: string;
	export const GIO_LAUNCHED_DESKTOP_FILE_PID: string;
	export const COLOR: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const QT_QPA_PLATFORMTHEME: string;
	export const E_PREFIX: string;
	export const GTK_IM_MODULE: string;
	export const LOGNAME: string;
	export const _: string;
	export const npm_config_prefix: string;
	export const npm_config_npm_version: string;
	export const XDG_SESSION_CLASS: string;
	export const RUST_LOG: string;
	export const XDG_SESSION_ID: string;
	export const npm_config_cache: string;
	export const npm_config_node_gyp: string;
	export const PATH: string;
	export const NODE: string;
	export const npm_package_name: string;
	export const XDG_SESSION_PATH: string;
	export const XDG_MENU_PREFIX: string;
	export const XDG_RUNTIME_DIR: string;
	export const GDK_BACKEND: string;
	export const E_RESTART: string;
	export const DISPLAY: string;
	export const CODEX_SANDBOX_NETWORK_DISABLED: string;
	export const LANG: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const XMODIFIERS: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XAUTHORITY: string;
	export const npm_lifecycle_script: string;
	export const SSH_AUTH_SOCK: string;
	export const XDG_GREETER_DATA_DIR: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const SHELL: string;
	export const MOKSHA_VERSION: string;
	export const DESKTOP: string;
	export const npm_package_version: string;
	export const npm_lifecycle_event: string;
	export const QT_ACCESSIBILITY: string;
	export const ELECTRON_RUN_AS_NODE: string;
	export const E_START: string;
	export const GDMSESSION: string;
	export const E_SCALE: string;
	export const E_LOCALE_DIR: string;
	export const BODHI_APTURL: string;
	export const GPG_AGENT_INFO: string;
	export const QT_IM_MODULE: string;
	export const XDG_VTNR: string;
	export const npm_config_globalconfig: string;
	export const npm_config_init_module: string;
	export const PWD: string;
	export const npm_execpath: string;
	export const XDG_CONFIG_DIRS: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const CLUTTER_IM_MODULE: string;
	export const XDG_DATA_DIRS: string;
	export const npm_config_global_prefix: string;
	export const E_DATA_DIR: string;
	export const npm_command: string;
	export const E_START_TIME: string;
	export const VSCODE_PID: string;
	export const INIT_CWD: string;
	export const EDITOR: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		VSCODE_CWD: string;
		VSCODE_ESM_ENTRYPOINT: string;
		E_CONF_PROFILE: string;
		USER: string;
		CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
		VSCODE_NLS_CONFIG: string;
		npm_config_user_agent: string;
		E_ICON_THEME: string;
		XDG_SEAT: string;
		MOKSHA_PKEXEC: string;
		ELM_CONFIG_DIR_XDG: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		SSH_AGENT_PID: string;
		XDG_SESSION_TYPE: string;
		npm_node_execpath: string;
		SHLVL: string;
		npm_config_noproxy: string;
		IBUS_NO_SNOOPER_APPS: string;
		HOME: string;
		CHROME_DESKTOP: string;
		E_LIB_DIR: string;
		DESKTOP_SESSION: string;
		npm_package_json: string;
		QT_STYLE_OVERRIDE: string;
		VSCODE_IPC_HOOK: string;
		GIO_LAUNCHED_DESKTOP_FILE: string;
		GTK_MODULES: string;
		XDG_SEAT_PATH: string;
		E_BIN_DIR: string;
		npm_config_userconfig: string;
		npm_config_local_prefix: string;
		E_HOME_DIR: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		E_IPC_SOCKET: string;
		GIO_LAUNCHED_DESKTOP_FILE_PID: string;
		COLOR: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		QT_QPA_PLATFORMTHEME: string;
		E_PREFIX: string;
		GTK_IM_MODULE: string;
		LOGNAME: string;
		_: string;
		npm_config_prefix: string;
		npm_config_npm_version: string;
		XDG_SESSION_CLASS: string;
		RUST_LOG: string;
		XDG_SESSION_ID: string;
		npm_config_cache: string;
		npm_config_node_gyp: string;
		PATH: string;
		NODE: string;
		npm_package_name: string;
		XDG_SESSION_PATH: string;
		XDG_MENU_PREFIX: string;
		XDG_RUNTIME_DIR: string;
		GDK_BACKEND: string;
		E_RESTART: string;
		DISPLAY: string;
		CODEX_SANDBOX_NETWORK_DISABLED: string;
		LANG: string;
		XDG_CURRENT_DESKTOP: string;
		XMODIFIERS: string;
		XDG_SESSION_DESKTOP: string;
		XAUTHORITY: string;
		npm_lifecycle_script: string;
		SSH_AUTH_SOCK: string;
		XDG_GREETER_DATA_DIR: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		SHELL: string;
		MOKSHA_VERSION: string;
		DESKTOP: string;
		npm_package_version: string;
		npm_lifecycle_event: string;
		QT_ACCESSIBILITY: string;
		ELECTRON_RUN_AS_NODE: string;
		E_START: string;
		GDMSESSION: string;
		E_SCALE: string;
		E_LOCALE_DIR: string;
		BODHI_APTURL: string;
		GPG_AGENT_INFO: string;
		QT_IM_MODULE: string;
		XDG_VTNR: string;
		npm_config_globalconfig: string;
		npm_config_init_module: string;
		PWD: string;
		npm_execpath: string;
		XDG_CONFIG_DIRS: string;
		VSCODE_CODE_CACHE_PATH: string;
		CLUTTER_IM_MODULE: string;
		XDG_DATA_DIRS: string;
		npm_config_global_prefix: string;
		E_DATA_DIR: string;
		npm_command: string;
		E_START_TIME: string;
		VSCODE_PID: string;
		INIT_CWD: string;
		EDITOR: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
