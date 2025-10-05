import { getCachedWeather, formatWeatherMessage } from '../lib/weather';

(async () => {
  try {
    const w = await getCachedWeather('Amarilis', 'Huánuco', 'PE');
    console.log(formatWeatherMessage('Amarilis', 'Huánuco', w));
  } catch (e) {
    console.error('Weather test error:', e);
  }
})();
