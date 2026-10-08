// Set the footer year without changing the page structure.
(function(){document.getElementById('year').textContent = new Date().getFullYear();})();

// Weather widget: uses Open-Meteo (no API key) and reverse geocoding.
(function(){
	const el = id => document.getElementById(id);
	const weatherCard = el('weather');
	const loading = weatherCard.querySelector('.weather-loading');
	const content = weatherCard.querySelector('.weather-content');
	const errorEl = el('weather-error');
	const refreshBtn = el('weather-refresh');
	const manualWrap = el('weather-manual');
	const placeInput = el('weather-place');
	const searchBtn = el('weather-search');

	function setLoading(show){ loading.style.display = show ? 'block' : 'none'; }
	function setContent(show){ content.style.display = show ? 'block' : 'none'; }
	function showError(msg){ errorEl.textContent = msg; errorEl.style.display = 'block'; }
	function clearError(){ errorEl.textContent=''; errorEl.style.display='none'; }
	function showManualInput(show){ manualWrap.style.display = show ? 'flex' : 'none'; }

	function weatherCodeToEmoji(code){
		if(code === 0) return {emoji:'☀️',desc:'Clear'};
		if([1,2,3].includes(code)) return {emoji:'⛅',desc:'Partly cloudy'};
		if([45,48].includes(code)) return {emoji:'🌫️',desc:'Fog'};
		if([51,53,55,56,57].includes(code)) return {emoji:'🌦️',desc:'Drizzle'};
		if([61,63,65,80,81,82].some(c=>c===code)) return {emoji:'🌧️',desc:'Rain'};
		if([66,67].includes(code)) return {emoji:'🌧️',desc:'Freezing rain'};
		if([71,73,75,77,85,86].includes(code)) return {emoji:'❄️',desc:'Snow'};
		if([95,96,99].includes(code)) return {emoji:'⛈️',desc:'Thunderstorm'};
		return {emoji:'🌤️',desc:'Weather'};
	}

	async function fetchWeather(lat, lon){
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`;
		const r = await fetch(url);
		if(!r.ok) throw new Error('Weather fetch failed');
		return r.json();
	}

	async function reverseGeocode(lat, lon){
		const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&count=1`;
		const r = await fetch(url);
		if(!r.ok) return null;
		const j = await r.json();
		if(j && j.results && j.results.length) return j.results[0].name + (j.results[0].country ? (', '+j.results[0].country) : '');
		return null;
	}

	async function geocodePlace(name){
		const q = encodeURIComponent(name);
		const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en`;
		const r = await fetch(url);
		if(!r.ok) throw new Error('Place lookup failed');
		const j = await r.json();
		if(j && j.results && j.results.length){
			const p = j.results[0];
			return {lat: p.latitude, lon: p.longitude, name: (p.name + (p.country ? (', '+p.country) : ''))};
		}
		throw new Error('No results for that place');
	}

	async function updateWeatherAt(lat, lon){
		try{
			clearError(); setContent(false); setLoading(true);
			const data = await fetchWeather(lat, lon);
			const cw = data.current_weather;
			if(!cw) throw new Error('No current weather available');
			const temp = Math.round(cw.temperature);
			const wc = weatherCodeToEmoji(cw.weathercode);
			el('weather-temp').textContent = `${temp}°C`;
			el('weather-emoji').textContent = wc.emoji;
			el('weather-desc').textContent = wc.desc + ` · wind ${Math.round(cw.windspeed)} km/h`;
			const loc = await reverseGeocode(lat, lon);
			el('weather-location').textContent = loc ? loc : `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
			setLoading(false); setContent(true);
		}catch(err){ setLoading(false); showError(err.message || 'Unable to load weather'); }
	}

	function tryGeolocationAndFetch(){
		if(!navigator.geolocation){ showError('Geolocation not available'); return; }
		setLoading(true); clearError(); setContent(false);
		navigator.geolocation.getCurrentPosition(pos=>{
			const lat = pos.coords.latitude; const lon = pos.coords.longitude;
			updateWeatherAt(lat, lon);
		}, err => {
			setLoading(false);
			const msg = err && err.message ? err.message : 'Location access denied. Allow location to see local weather.';
			showError(msg);
		}, {maximumAge:600000, timeout:8000});
	}

	refreshBtn.addEventListener('click', ()=>{ tryGeolocationAndFetch(); });
	searchBtn.addEventListener('click', async ()=>{
		const q = (placeInput.value || '').trim();
		if(!q) { showError('Please enter a place name'); return; }
		try{ clearError(); setLoading(true); setContent(false);
			const p = await geocodePlace(q);
			if(p){ await updateWeatherAt(p.lat, p.lon); el('weather-location').textContent = p.name; }
		}catch(err){ showError(err.message || 'Place lookup failed'); }
		finally{ setLoading(false); }
	});

	// Start with the visitor's current location when available.
	tryGeolocationAndFetch();
})();