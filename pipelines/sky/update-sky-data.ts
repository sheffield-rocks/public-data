
import { writeFileSync } from 'fs';
import { join } from 'path';

// Sheffield Coordinates
const LAT = 53.3811;
const LONG = -1.4701;

async function updateSkyData() {
  console.log('Fetching sky data for Sheffield...');

  try {
    // Fetch directly from Open-Meteo
    // getting current weather and daily sunrise/sunset
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LONG}&current=weather_code&daily=sunrise,sunset&timezone=Europe%2FLondon&forecast_days=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract relevant data
    // Note: Open-Meteo returns arrays for daily data
    const sunrise = data.daily.sunrise[0];
    const sunset = data.daily.sunset[0];
    const weatherCode = data.current.weather_code;

    const config = {
      sunrise,
      sunset,
      weatherCode,
      updatedAt: new Date().toISOString(),
    };

    console.log('New Sky Config:', config);

    // Path to data/sky/sky-config.json
    // We assume we are running from data repo root
    const outputPath = join(process.cwd(), 'data', 'sky', 'sky-config.json');
    
    writeFileSync(outputPath, JSON.stringify(config, null, 2));
    console.log(`Successfully wrote config to ${outputPath}`);

  } catch (error) {
    console.error('Error updating sky data:', error);
    process.exit(1);
  }
}

updateSkyData();
