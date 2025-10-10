export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["engine.worklet.js","icons/192.png","icons/512.png"]),
	mimeTypes: {".js":"text/javascript",".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.hqo_3ySK.js",app:"_app/immutable/entry/app.CBxvAN74.js",imports:["_app/immutable/entry/start.hqo_3ySK.js","_app/immutable/chunks/OrQlYTQI.js","_app/immutable/chunks/DDR6tWfP.js","_app/immutable/chunks/uVtHz8AV.js","_app/immutable/entry/app.CBxvAN74.js","_app/immutable/chunks/uVtHz8AV.js","_app/immutable/chunks/DDR6tWfP.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DbUCoicb.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
