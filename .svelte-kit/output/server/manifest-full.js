export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["engine.worklet.js","favicon.png","fluid-render.worklet.js","fluidsynth/GeneralUser-GS.sf2","fluidsynth/libfluidsynth-2.3.0.js","fluidsynth/libfluidsynth-2.3.0.wasm","icons/192.png","icons/512.png"]),
	mimeTypes: {".js":"text/javascript",".png":"image/png",".wasm":"application/wasm"},
	_: {
		client: null,
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
