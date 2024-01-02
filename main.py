from flask import Flask, render_template, flash, redirect, url_for, request
import os

app = Flask(
    __name__,
    template_folder='templates',  # Name of html file folder
    static_folder='static'  # Name of directory for static files
)

@app.route('/')
def home_page():
  # data will be loaded with onload and the getdata route
  return render_template('index.html')

myport = 4141
if len(os.sys.argv) == 2:
  myport = os.sys.argv[1]

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=myport, debug=True)