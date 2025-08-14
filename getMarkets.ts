async function getPolymarketMarkets() {
  try {
    // // // put the id in the params
    // // // get the id and value and put in orderPut.ts
    const response = await fetch('https://gamma-api.polymarket.com/markets?id=542538', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const markets = await response.json();
    return markets;
  } catch (error) {
    console.error('Error fetching Polymarket markets:', error);
    throw error;
  }
}

// Example usage
async function main() {
  try {
    const markets = await getPolymarketMarkets();
    const market = markets[0];
    
    // Extract the question
    console.log('Question:', market.question);
    console.log('');
    
    // Display tick size information
    console.log('=== TICK SIZE INFORMATION ===');
    console.log('Order Price Min Tick Size:', market.orderPriceMinTickSize);
    console.log('Order Min Size:', market.orderMinSize);
    console.log('Spread:', market.spread);
    console.log('');
  //   console.log("Base token decimals:", market.baseToken);
  // console.log("Quote token decimals:", market);
    // Parse outcomes and CLOB token IDs
    const outcomes = JSON.parse(market.outcomes);
    const clobTokenIds = JSON.parse(market.clobTokenIds);
    const outcomePrices = JSON.parse(market.outcomePrices);
    
    // Display Yes/No with their respective CLOB token IDs and prices
    console.log('Outcomes with CLOB Token IDs and Prices:');
    outcomes.forEach((outcome: string, index: number) => {
      console.log(`${outcome}:`);
      console.log(`  CLOB Token ID: ${clobTokenIds[index]}`);
      console.log(`  Price: ${outcomePrices[index]}`);
      console.log('');
    });
    
    // Explain tick size
    console.log('=== WHAT IS TICK SIZE? ===');
    console.log('Tick size is the minimum price increment allowed when placing orders.');
    console.log('In this market, the minimum tick size is:', market.orderPriceMinTickSize);
    console.log('This means you can only place orders at price levels that are multiples of', market.orderPriceMinTickSize);
    console.log('For example, valid prices would be: 0.00, 0.01, 0.02, 0.03, etc.');
    console.log('Invalid prices would be: 0.005, 0.015, etc.');
    console.log('');
    
    // // You can access specific market data like:
    // if (markets && markets.length > 0) {
    //   console.log('First market:', markets[0]);
    //   console.log('Number of markets:', markets.length);
    // }
  } catch (error) {
    console.error('Failed to fetch markets:', error);
  }
}

// Export the function for use in other files
export { getPolymarketMarkets };

// Uncomment the line below to run the example
main();
