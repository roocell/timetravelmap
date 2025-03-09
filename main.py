from flask import Flask, render_template, flash, redirect, url_for, request
import os
import logging

app = Flask(
    __name__,
    template_folder='templates',  # Name of html file folder
    static_folder='static'  # Name of directory for static files
)

# Middleware to enforce HTTPS
@app.before_request
def before_request():
    if not request.is_secure:
        return redirect(f"https://{request.host}{request.path}", code=301)


# disable all the http GET 404 logs
# Suppress logging for static files
@app.before_request
def disable_static_logs():
    if request.path.startswith('/static/data'):
        logging.getLogger('werkzeug').setLevel(logging.ERROR)

@app.route('/')
def home_page():
  # data will be loaded with onload and the getdata route
  return render_template('index.html')

myport = 4141
if len(os.sys.argv) == 2:
  myport = os.sys.argv[1]

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=myport, debug=True,
          ssl_context=('/home/roocell/fullchain.pem', '/home/roocell/privkey.pem'))