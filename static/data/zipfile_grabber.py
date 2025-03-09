import os
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Configure Selenium WebDriver
options = webdriver.ChromeOptions()
options.add_argument("--headless")  # Run in headless mode (no GUI)
driver = webdriver.Chrome(options=options)

# Login credentials
login_url = "https://sign.library.carleton.ca/login"
username = r"CUNET\Eerussell"
password = "WeeQu88_708"

# Navigate to the login page
driver.get(login_url)

# Find and fill the login form (adjust these selectors based on the website)
driver.find_element(By.ID, "userNameInput").send_keys(username)
driver.find_element(By.ID, "passwordInput").send_keys(password)
driver.find_element(By.ID, "submitButton").send_keys(Keys.RETURN)

# Wait for login to complete (adjust time as needed)
time.sleep(5)

# Now navigate to the target page
target_url = "https://sign.library.carleton.ca/resources/gis-data/access/_Ottawa_Gatineau_Region/Lidar/City_of_Ottawa_2015/TIF/"
target_url = "https://sign.library.carleton.ca/resources/gis-data/access/_Ottawa_Gatineau_Region/Lidar/City_of_Ottawa_2014/TIF/"
driver.get(target_url)

# Extract page source after login
soup = BeautifulSoup(driver.page_source, "html.parser")

# Find all .zip file links
zip_links = soup.find_all("a", href=lambda href: href and href.endswith(".zip"))

print(f"Found {len(zip_links)} .zip files.")

# Directory to save the files
download_dir = "downloaded_zips"
os.makedirs(download_dir, exist_ok=True)

# Extract session cookies to use with requests
session = requests.Session()
for cookie in driver.get_cookies():
    session.cookies.set(cookie["name"], cookie["value"])

# Close Selenium WebDriver
driver.quit()

# Download each file
for link in zip_links:
    zip_url = urljoin(target_url, link["href"])
    zip_name = os.path.basename(zip_url)
    zip_path = os.path.join(download_dir, zip_name)

    print(f"Downloading {zip_name}...")

    # Download the file using requests with the session cookies
    with session.get(zip_url, stream=True) as r:
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    print(f"Downloaded: {zip_name}")

print("All downloads completed!")
