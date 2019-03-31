# single.js

Single-page websites, simplified.

[Try the demo!](https://singlejs.hell.sh/)

## Edit the demo!

Run

	git clone https://github.com/hell-sh/single.js
	cd single.js
	php -S localhost:80

and then navigate to [localhost](http://localhost)!

## Configuring your web server

Because you obviously don't want to use PHP's built-in HTTP server in production.

### Nginx

1. In your `server` block, add `try_files $uri /index.html =404;`

2. Reload Nginx

### Apache

1. Ensure you have `libapache2-mod-php` installed

2. Rename your `index.html` to `index.php`

3. Add `<?php http_response_code(200); ?>` to the beginning of your `index.php`

4. In your `VirtualHost` tag, add `ErrorDocument 404 /index.php`

5. Restart Apache
