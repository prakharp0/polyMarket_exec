#!/usr/bin/env ts-node

/**
 * Simple script to fetch events from Polymarket Gamma API
 * Run with: npx ts-node fetchEvents.ts
 */

async function fetchPolymarketEvents() {
  // // // change the slug to get a specific event
  // // // it returns markets and use the market id in getMarkets.ts to get token details
  const url = 'https://gamma-api.polymarket.com/events?slug=fed-decision-in-september';
  
  try {
    console.log('Fetching events from Polymarket Gamma API...');
    console.log(`URL: ${url}\n`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('\nEvents found:', data.events?.length || 0);
    
    if (data.events && data.events.length > 0) {
      console.log('\n=== First 5 Events ===\n');
      
      data.events.slice(0, 5).forEach((event: any, index: number) => {
        console.log(`${index + 1}. ${event.title || 'No title'}`);
        console.log(`   ID: ${event.id || 'No ID'}`);
        console.log(`   Category: ${event.category || 'No category'}`);
        console.log(`   Status: ${event.status || 'No status'}`);
        
        if (event.closeDate) {
          console.log(`   Close Date: ${event.closeDate}`);
        }
        
        if (event.volume) {
          console.log(`   Volume: $${event.volume.toLocaleString()}`);
        }
        
        console.log(''); // Empty line for separation
      });
      
      // Save full response to file
      const fs = await import('fs/promises');
      await fs.writeFile('polymarket-events-raw.json', JSON.stringify(data, null, 2));
      console.log('Full response saved to polymarket-events-raw.json');
      
    } else {
      console.log('No events found in the response.');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error fetching events:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the function
fetchPolymarketEvents();
