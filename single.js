// Copyright (c) Hell.sh

(function()
{
	let style = document.createElement("style");
	style.textContent = `[data-route]:not(.visible){display:none}`;
	document.head.appendChild(style);

	class EventEmitter
	{
		constructor()
		{
			this.event_handlers = {};
		}

		on(event_name, func)
		{
			if(typeof func != "function")
			{
				throw "Event handler has to be a function.";
			}
			this.event_handlers[event_name] = func;
			return this;
		}

		off(event_name)
		{
			delete this.event_handlers[event_name];
			return this;
		}

		fire(event_name, args)
		{
			if(event_name in this.event_handlers)
			{
				this.event_handlers[event_name].call(this, args);
			}
			return this;
		}
	}

	class Route extends EventEmitter
	{
		constructor(elm, paths)
		{
			super();
			this.elm = elm;
			this.paths = paths;
			this.title = undefined;
			if(elm.hasAttribute("data-title"))
			{
				this.title = this.elm.getAttribute("data-title");
				this.elm.removeAttribute("data-title");
			}
			else if(document.querySelector("title") != null)
			{
				this.title = document.querySelector("title").textContent;
			}
			else
			{
				this.title = this.paths[0];
			}
		}

		get element()
		{
			return this.elm;
		}
	}

	class StandardRoute extends Route
	{
		constructor(elm)
		{
			let paths = [];
			elm.getAttribute("data-route").split(",").forEach(name => {
				paths.push(name.trim());
			});
			super(elm, paths);
		}

		getCanonicalPath()
		{
			if(this.paths[0].substr(0, 1) == "/")
			{
				return this.paths[0];
			}
			if(this.paths.length > 1)
			{
				return this.paths[1];
			}
			return "/" + this.paths[0];
		}
	}

	class RegexRoute extends Route
	{
		constructor(elm)
		{
			super(elm, [elm.getAttribute("data-route").substr(2)]);
			this.regex = new RegExp(this.paths[0]);
		}

		getArgs(path)
		{
			let res = this.regex.exec(path);
			if(res && res.length > 0)
			{
				return res;
			}
			return false;
		}
	}

	class SingleApp extends EventEmitter
	{
		constructor()
		{
			super();
			this.routes = [];
			document.body.querySelectorAll("[data-route]").forEach(elm => {
				if(elm.getAttribute("data-route").substr(0, 2) == "~ ")
				{
					this.routes.push(new RegexRoute(elm));
				}
				else
				{
					this.routes.push(new StandardRoute(elm));
				}
			});
			if(this.routes.length == 0)
			{
				console.error("[single.js] You need to define at least one route");
			}
			this.routes.forEach(route => {
				route.paths.forEach(path => {
					for(let i = 0; i < this.routes; i++)
					{
						if(this.routes[i] !== route && this.routes[i].paths.indexOf(path) > -1)
						{
							console.error("[single.js] Duplicate path: " + path);
						}
					}
				});
			});
			window.onpopstate = event => {
				event.preventDefault();
				single.loadRoute();
			};
			document.body.addEventListener("click", event => {
				let elm = event.target;
				while(!(elm instanceof HTMLAnchorElement) && !(elm instanceof HTMLBodyElement))
				{
					elm = elm.parentNode;
				}
				if(elm instanceof HTMLAnchorElement && !elm.hasAttribute("target") && elm.hasAttribute("href") && elm.getAttribute("href").substr(0, 1) == "/")
				{
					event.preventDefault();
					single.loadRoute(new URL(elm.href));
				}
			});
			this.timeouts = [];
			this.intervals = [];
		}

		getRoute(route)
		{
			let elm = route instanceof HTMLElement;
			if(elm)
			{
				if(!route.hasAttribute("data-route"))
				{
					throw "Invalid route element: " + route;
				}
				route = route.getAttribute("data-route");
				if(route.substr(0, 2) == "~ ")
				{
					route = route.substr(2);
				}
				else
				{
					route = route.split(",")[0];
				}
			}
			else if(route.substr(0, 2) == "~ ")
			{
				route = route.substr(2);
			}
			for(let i = 0; i < this.routes.length; i++)
			{
				if(this.routes[i].paths.indexOf(route) > -1)
				{
					return this.routes[i];
				}
			}
			if(!elm)
			{
				try
				{
					elm = document.querySelector(route);
					if(elm)
					{
						return this.getRoute(elm);
					}
				}
				catch(ignored){}
			}
			return null;
		}

		loadRoute(path)
		{
			this.timeouts.forEach(clearTimeout);
			this.intervals.forEach(clearInterval);
			if(path === undefined)
			{
				path = new URL(location.href);
			}
			else if(typeof path == "string" && path.substr(0, 1) == "/")
			{
				path = new URL(location.protocol + location.hostname + path);
			}
			let route, args = false, urlextra = "";
			if(path instanceof URL)
			{
				urlextra = path.search + path.hash;
				path = path.pathname;
			}
			for(let i = 0; i < this.routes.length; i++)
			{
				if(this.routes[i] instanceof RegexRoute)
				{
					args = this.routes[i].getArgs(path);
					if(args !== false)
					{
						route = this.routes[i];
						break;
					}
				}
				else if(this.routes[i].paths.indexOf(path) > -1)
				{
					route = this.routes[i];
					break;
				}
			}
			if(route === undefined)
			{
				route = this.getRoute("404");
				if(route === null)
				{
					route = this.routes[0];
					path = route.getCanonicalPath();
				}
			}
			if(args === false)
			{
				args = [path];
			}
			route.fire("beforeload", args);
			this.fire("route_beforeload", {
				route: route,
				args: args
			});
			this.routes.forEach(r => {
				if(r !== route)
				{
					r.elm.classList.remove("visible");
				}
			});
			route.elm.classList.add("visible");
			path += urlextra;
			if(location.pathname.toString() != path)
			{
				history.pushState({}, route.title, path);
			}
			document.querySelector("title").textContent = route.title;
			route.fire("load", args);
			this.fire("route_load", {
				route: route,
				args: args
			});
		}

		setTimeout(f, i)
		{
			this.timeouts.push(window.setTimeout(f, i));
		}

		setInterval(f, i)
		{
			this.intervals.push(window.setInterval(f, i));
		}
	}

	console.assert(!("single" in window));
	window.single = new SingleApp();
	if(["interactive", "complete"].indexOf(document.readyState) > -1)
	{
		console.warn("single.js was loaded in too late. this will cause issues if you depend on single.js events.");
		window.single.loadRoute();
	}
	else
	{
		document.addEventListener("DOMContentLoaded", () => window.single.loadRoute());
	}
})();
