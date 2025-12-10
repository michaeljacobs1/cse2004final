const API_KEY = '761703950e11c0d76e1b347abf759151';
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5';

let currentUnit = 'fahrenheit';
let currentWeatherData = null;
let map = null;
let mapMarker = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const unitToggles = document.querySelectorAll('.unit-toggle');
const weatherDisplay = document.getElementById('weatherDisplay');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const favoriteBtn = document.getElementById('favoriteBtn');
const viewDetailsBtn = document.getElementById('viewDetailsBtn');
const navLinks = document.querySelectorAll('.nav-link');
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const pages = document.querySelectorAll('.page');
const detailsModal = document.getElementById('detailsModal');
const modalClose = document.querySelector('.modal-close');
const favoritesList = document.getElementById('favoritesList');

document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeEventListeners();
    loadFavorites();
});

function initializeNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            switchPage(page);
            updateActiveNav(link);
        });
    });

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });
}

function switchPage(pageName) {
    pages.forEach(page => {
        page.classList.remove('active');
    });

    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    if (pageName === 'favorites') {
        displayFavorites();
    }
}

function updateActiveNav(activeLink) {
    navLinks.forEach(link => link.classList.remove('active'));
    activeLink.classList.add('active');
}

function initializeEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    unitToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            unitToggles.forEach(t => t.classList.remove('active'));
            toggle.classList.add('active');
            currentUnit = toggle.dataset.unit;
            if (currentWeatherData) {
                displayWeather(currentWeatherData.current, currentWeatherData.forecast);
            }
        });
    });

    favoriteBtn.addEventListener('click', toggleFavorite);
    viewDetailsBtn.addEventListener('click', showDetailsModal);
    modalClose.addEventListener('click', closeModal);

    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailsModal.classList.contains('active')) {
            closeModal();
        }
    });
}

function handleSearch() {
    const city = cityInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }

    if (API_KEY === 'YOUR_API_KEY' || !API_KEY || API_KEY.trim() === '') {
        showError('API key not configured. Please replace YOUR_API_KEY with your OpenWeatherMap API key.');
        return;
    }

    fetchWeatherData(city);
}

async function fetchWeatherData(city) {
    hideError();
    showLoading();
    hideWeather();

    try {
        const currentWeatherUrl = `${API_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
        const currentResponse = await fetch(currentWeatherUrl);

        if (!currentResponse.ok) {
            const errorData = await currentResponse.json().catch(() => ({}));
            const errorMsg = errorData.message || 'Unknown error';

            if (currentResponse.status === 404) {
                throw new Error('City not found. Please check the spelling and try again.');
            } else if (currentResponse.status === 401) {
                throw new Error(`Invalid API key: ${errorMsg}. Please check your API key.`);
            } else {
                throw new Error(`Failed to fetch weather data: ${errorMsg}`);
            }
        }

        const currentData = await currentResponse.json();

        const forecastUrl = `${API_BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
        const forecastResponse = await fetch(forecastUrl);

        if (!forecastResponse.ok) {
            throw new Error('Failed to fetch forecast data');
        }

        const forecastData = await forecastResponse.json();

        currentWeatherData = {
            current: currentData,
            forecast: forecastData
        };

        displayWeather(currentData, forecastData);
        hideLoading();
        showWeather();
        if (!map) {
            initializeMap();
        } else {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
        updateMap(currentData.coord.lat, currentData.coord.lon, currentData.name);
        updateFavoriteButton(currentData.name, currentData.sys.country);

    } catch (error) {
        hideLoading();
        showError(error.message || 'An error occurred while fetching weather data.');
    }
}

function displayWeather(currentData, forecastData) {
    const temp = currentUnit === 'celsius'
        ? currentData.main.temp
        : (currentData.main.temp * 9 / 5) + 32;
    const feelsLike = currentUnit === 'celsius'
        ? currentData.main.feels_like
        : (currentData.main.feels_like * 9 / 5) + 32;
    const windSpeed = currentUnit === 'celsius'
        ? currentData.wind.speed
        : currentData.wind.speed * 2.237;

    document.getElementById('cityName').textContent = `${currentData.name}, ${currentData.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(temp)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.getElementById('description').textContent = currentData.weather[0].description;
    document.getElementById('feelsLike').textContent = `${Math.round(feelsLike)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.getElementById('humidity').textContent = `${currentData.main.humidity}%`;
    document.getElementById('windSpeed').textContent = `${Math.round(windSpeed * 10) / 10} ${currentUnit === 'celsius' ? 'm/s' : 'mph'}`;
    document.getElementById('pressure').textContent = `${currentData.main.pressure} hPa`;

    const iconCode = currentData.weather[0].icon;
    const weatherIcon = document.getElementById('weatherIcon');
    weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    weatherIcon.alt = currentData.weather[0].description;

    displayForecast(forecastData);
}

function displayForecast(forecastData) {
    const forecastList = document.getElementById('forecastList');

    const dailyForecasts = {};
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toDateString();

        if (!dailyForecasts[dateKey]) {
            dailyForecasts[dateKey] = {
                date: date,
                items: []
            };
        }
        dailyForecasts[dateKey].items.push(item);
    });

    const sortedDates = Object.keys(dailyForecasts).sort((a, b) => {
        return new Date(a) - new Date(b);
    }).slice(0, 5);

    forecastList.innerHTML = '';

    sortedDates.forEach(dateKey => {
        const dayData = dailyForecasts[dateKey];
        const noonForecast = dayData.items.reduce((closest, item) => {
            const itemHour = new Date(item.dt * 1000).getHours();
            const closestHour = new Date(closest.dt * 1000).getHours();
            return Math.abs(itemHour - 12) < Math.abs(closestHour - 12) ? item : closest;
        }, dayData.items[0]);

        const date = new Date(noonForecast.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const temp = currentUnit === 'celsius'
            ? noonForecast.main.temp
            : (noonForecast.main.temp * 9 / 5) + 32;

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-date">${monthDay}</div>
            <img src="https://openweathermap.org/img/wn/${noonForecast.weather[0].icon}@2x.png" 
                 alt="${noonForecast.weather[0].description}" 
                 class="forecast-icon">
            <div class="forecast-temp">${Math.round(temp)}°${currentUnit === 'celsius' ? 'C' : 'F'}</div>
            <div class="forecast-desc">${noonForecast.weather[0].description}</div>
        `;
        forecastList.appendChild(forecastItem);
    });
}

function initializeMap() {
    if (map) return;

    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    map = L.map('map').setView([40.7128, -74.0060], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

function updateMap(lat, lon, cityName) {
    if (!map) {
        initializeMap();
    }

    setTimeout(() => {
        if (mapMarker) {
            map.removeLayer(mapMarker);
        }

        map.setView([lat, lon], 10);
        mapMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup(`<b>${cityName}</b><br>Weather Location`)
            .openPopup();

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<span style="color: #667eea; font-size: 30px;">●</span>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        mapMarker.setIcon(customIcon);

        map.invalidateSize();
    }, 150);
}

function toggleFavorite() {
    if (!currentWeatherData) return;

    const cityName = currentWeatherData.current.name;
    const country = currentWeatherData.current.sys.country;
    const locationKey = `${cityName},${country}`;

    const index = favorites.findIndex(fav => fav.key === locationKey);

    if (index > -1) {
        favorites.splice(index, 1);
        favoriteBtn.classList.remove('active');
        favoriteBtn.querySelector('.favorite-icon').textContent = '+';
    } else {
        favorites.push({
            key: locationKey,
            name: cityName,
            country: country,
            lat: currentWeatherData.current.coord.lat,
            lon: currentWeatherData.current.coord.lon,
            data: currentWeatherData.current
        });
        favoriteBtn.classList.add('active');
        favoriteBtn.querySelector('.favorite-icon').textContent = '★';
    }

    saveFavorites();
}

function updateFavoriteButton(cityName, country) {
    const locationKey = `${cityName},${country}`;
    const isFavorite = favorites.some(fav => fav.key === locationKey);

    if (isFavorite) {
        favoriteBtn.classList.add('active');
        favoriteBtn.querySelector('.favorite-icon').textContent = '★';
    } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.querySelector('.favorite-icon').textContent = '+';
    }
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function loadFavorites() {
    favorites = JSON.parse(localStorage.getItem('favorites')) || [];
}

function displayFavorites() {
    const emptyState = document.getElementById('emptyFavorites');

    if (favorites.length === 0) {
        favoritesList.innerHTML = '';
        favoritesList.appendChild(emptyState);
        return;
    }

    favoritesList.innerHTML = '';

    favorites.forEach((favorite, index) => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';

        const temp = currentUnit === 'celsius'
            ? favorite.data.main.temp
            : (favorite.data.main.temp * 9 / 5) + 32;
        const description = favorite.data.weather[0].description;
        const iconCode = favorite.data.weather[0].icon;

        favoriteItem.innerHTML = `
            <div class="favorite-item-header">
                <div class="favorite-city-name">${favorite.name}, ${favorite.country}</div>
                <div class="favorite-actions">
                    <button class="favorite-action-btn view" onclick="viewFavorite('${favorite.key}')" aria-label="View weather">
                        <span>View</span>
                    </button>
                    <button class="favorite-action-btn delete" onclick="deleteFavorite(${index})" aria-label="Delete favorite">
                        <span>Delete</span>
                    </button>
                </div>
            </div>
            <div class="favorite-temp">${Math.round(temp)}°${currentUnit === 'celsius' ? 'C' : 'F'}</div>
            <div class="favorite-desc">${description}</div>
            <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" 
                 alt="${description}" 
                 style="width: 60px; height: 60px; margin: 0 auto; display: block;">
        `;
        favoritesList.appendChild(favoriteItem);
    });
}

function viewFavorite(locationKey) {
    const favorite = favorites.find(fav => fav.key === locationKey);
    if (!favorite) return;

    cityInput.value = favorite.name;
    fetchWeatherData(favorite.name);
    switchPage('home');
    updateActiveNav(document.querySelector('[data-page="home"]'));
}

function deleteFavorite(index) {
    if (confirm('Are you sure you want to remove this location from favorites?')) {
        favorites.splice(index, 1);
        saveFavorites();
        displayFavorites();

        if (currentWeatherData) {
            updateFavoriteButton(
                currentWeatherData.current.name,
                currentWeatherData.current.sys.country
            );
        }
    }
}

window.viewFavorite = viewFavorite;
window.deleteFavorite = deleteFavorite;

function showDetailsModal() {
    if (!currentWeatherData) return;

    const data = currentWeatherData.current;
    const modalBody = document.getElementById('modalBody');

    const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) : 'N/A';
    const uvIndex = 'N/A';
    const cloudiness = data.clouds ? data.clouds.all : 'N/A';

    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-item-label">Temperature</div>
                <div class="detail-item-value">
                    ${Math.round(currentUnit === 'celsius' ? data.main.temp : (data.main.temp * 9 / 5) + 32)}°${currentUnit === 'celsius' ? 'C' : 'F'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Feels Like</div>
                <div class="detail-item-value">
                    ${Math.round(currentUnit === 'celsius' ? data.main.feels_like : (data.main.feels_like * 9 / 5) + 32)}°${currentUnit === 'celsius' ? 'C' : 'F'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Min Temperature</div>
                <div class="detail-item-value">
                    ${Math.round(currentUnit === 'celsius' ? data.main.temp_min : (data.main.temp_min * 9 / 5) + 32)}°${currentUnit === 'celsius' ? 'C' : 'F'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Max Temperature</div>
                <div class="detail-item-value">
                    ${Math.round(currentUnit === 'celsius' ? data.main.temp_max : (data.main.temp_max * 9 / 5) + 32)}°${currentUnit === 'celsius' ? 'C' : 'F'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Humidity</div>
                <div class="detail-item-value">${data.main.humidity}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Pressure</div>
                <div class="detail-item-value">${data.main.pressure} hPa</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Wind Speed</div>
                <div class="detail-item-value">
                    ${Math.round((currentUnit === 'celsius' ? data.wind.speed : data.wind.speed * 2.237) * 10) / 10} ${currentUnit === 'celsius' ? 'm/s' : 'mph'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Wind Direction</div>
                <div class="detail-item-value">${data.wind.deg ? data.wind.deg + '°' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Cloudiness</div>
                <div class="detail-item-value">${cloudiness}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Visibility</div>
                <div class="detail-item-value">${visibility} km</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Sunrise</div>
                <div class="detail-item-value">${sunrise}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Sunset</div>
                <div class="detail-item-value">${sunset}</div>
            </div>
        </div>
    `;

    detailsModal.classList.add('active');
}

function closeModal() {
    detailsModal.classList.remove('active');
}

function showLoading() {
    loading.classList.add('show');
}

function hideLoading() {
    loading.classList.remove('show');
}

function showWeather() {
    weatherDisplay.classList.add('show');
}

function hideWeather() {
    weatherDisplay.classList.remove('show');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function hideError() {
    errorMessage.classList.remove('show');
}

