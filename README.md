OAuth2 Setup
============

For school, I did a research on the OAuth 2.0 protocol. I completely wrote down the [OAuth 2.0 RFC (6749)](https://tools.ietf.org/html/rfc6749)
so I would understand how to implement the protocol correctly. Afterwards I started to write this complete setup from scratch, which implements
the *Authorization Code Grant*, written for Node. I did this as good as I could and with the best intentions, so if you see any mistakes or wrong
interpretations don't scream but please write a comment or fork this project.

To start this setup on your local machine, first make sure you have [Node.js](http://nodejs.org/) and [MongoDB](http://www.mongodb.org/) installed.
Then, because the transport of data within the OAuth 2.0 protocol should have TLS, every transport within this setup is going through the HTTPS
protocol. Therefore you should first create your own private-key and certificate, and place them in the right directories *(Which you can see within the settings file)*.

After everything is installed and your certificate has been created, follow the following steps:

```
git clone git@github.com:StevenOosterbeek/oauth2-setup.git
```

```
npm install
```

Start every server as a seperate Node proces, like this:
```
cd auth-server && node server.js
```

--------

To let the system log every HTTPS request made, to see what really is happening, you can turn on this option within the settings file:

```javascript
logRequests: true
```