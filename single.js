// Copyright (c) 2019, Hell.sh

(function()
{
	let style = document.createElement("style");
	style.textContent = `[data-route]:not(.visible){display:none}`;
	document.head.appendChild(style);

	class SingleEventEmitter
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

	class SingleRoute extends SingleEventEmitter
	{
		constructor(elm)
		{
			super();
			this.elm = elm;
			this.paths = [];
			this.elm.getAttribute("data-route").split(",").forEach(name => {
				this.paths.push(name.trim());
			});
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
				this.title = this.getCanonicalPath();
			}
		}

		get element()
		{
			return this.elm;
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

		isRegexRoute()
		{
			return this.paths.length == 1 && this.paths[0].substr(0, 1) == "^" && this.paths[0].substr(this.paths[0].length - 1) == "$";
		}

		getArgs(path)
		{
			if(this.isRegexRoute())
			{
				const regex = new RegExp(this.paths[0]);
				let res = regex.exec(path);
				if(res && res.length > 0)
				{
					return res;
				}
			}
			return false;
		}
	}

	class SingleApp extends SingleEventEmitter
	{
		constructor()
		{
			super();
			this.routes = [];
			document.body.querySelectorAll("[data-route]").forEach(elm => {
				this.routes.push(new SingleRoute(elm));
			});
			if(this.routes.length == 0)
			{
				throw "You need to define at least one route.";
			}
			this.routes.forEach(route => {
				route.paths.forEach(path => {
					for(let i = 0; i < this.routes; i++)
					{
						if(this.routes[i] !== route && this.routes[i].paths.indexOf(path) > -1)
						{
							throw "Duplicate path: " + path;
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
					single.loadRoute(elm.getAttribute("href"));
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
				route = route.getAttribute("data-route").split(",")[0];
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
				path = location.pathname.toString();
			}
			let route, args = false;
			for(let i = 0; i < this.routes.length; i++)
			{
				if(this.routes[i].isRegexRoute())
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

	window.single = {
		load: callback => {
			if(["interactive", "complete"].indexOf(document.readyState) > -1)
			{
				callback.call(window.single = new SingleApp());
			}
			else
			{
				document.addEventListener("DOMContentLoaded", () => {
					callback.call(window.single = new SingleApp());
				});
			}
		},
		ensureLoaded: callback => single.load(callback)
	};
})();
