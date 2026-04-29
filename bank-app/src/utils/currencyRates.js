let cachedRates = null;
let lastFetch = null;

export async function getExchangeRates() {
  if (cachedRates && lastFetch && (Date.now() - lastFetch) < 60000) {
    return cachedRates;
  }
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/RUB');
    const data = await res.json();
    cachedRates = {
      RUB: 1,
      USD: data.rates.USD,
      EUR: data.rates.EUR,
    };
    lastFetch = Date.now();
    return cachedRates;
  } catch (err) {
    console.error("Ошибка загрузки курсов", err);
    throw new Error("Не удалось загрузить курсы валют");
  }
}

export async function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const rates = await getExchangeRates();
  const amountInRUB = amount / rates[fromCurrency];
  const converted = amountInRUB * rates[toCurrency];
  return parseFloat(converted.toFixed(2));
}