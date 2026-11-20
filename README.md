# Thinkers_ Auction Lab

A small fan-made tool to understand the **Thinkers_** drop on **NFTX** before Nov 24.

The mint uses a Uniswap V4 **CCA (Continuous Clearing Auction)**, which works nothing like a normal FCFS mint. I wanted to actually see how a budget + max price bid fills block by block, so I built a simulator for it.

## What's inside
- **Auction simulator**: set your budget, max price and when you join, add a crowd (calm / hyped / whales) and watch the clearing price per block
- **Art ↔ token converter**: 1 NFT = 1 ERC20, swap any time
- **Stock what-if**: rough calculator while the paired stock is still unannounced

## Notes
- The auction math is a simplified model I wrote to learn how CCA behaves. It is not the official contract logic.
- Not affiliated with NFTX or Thinkers_. Not financial advice.

Plain HTML/CSS/JS, no build step. Open `index.html` or visit the GitHub Pages link.

made by [@AzrarM](https://x.com/AzrarM)
