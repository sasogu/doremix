export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["engine.worklet.js","fluid-render.worklet.js","icons/192.png","icons/512.png"]),
	mimeTypes: {".js":"text/javascript",".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.CxnFA2EO.js",app:"_app/immutable/entry/app.CZA1xa3t.js",imports:["_app/immutable/entry/start.CxnFA2EO.js","_app/immutable/chunks/7viwlS33.js","_app/immutable/chunks/C4PRqRjh.js","_app/immutable/chunks/BmcGoB79.js","_app/immutable/entry/app.CZA1xa3t.js","_app/immutable/chunks/BmcGoB79.js","_app/immutable/chunks/C4PRqRjh.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/BntuhCxf.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
