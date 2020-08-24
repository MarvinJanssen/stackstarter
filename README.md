# Stackstarter

Stackstarter is a Clarity smart contract for crowdfunding on the STX blockchain. When a campaign is created, the fundraiser sets a goal in STX and a duration in blocks. In order for a campaign to be successfully funded, the campaign needs to receive investments matching or exceeding the funding goal before the target block-height is reached. The fundraiser can then collect the funds.

Investors can request a refund at any point while the campaign is still active. This ensures that the investors stay in control of their STX until the funding goal is reached. If the campaign is unsuccessful, investors can likewise request a refund.

In order to allow for nuanced investments and crowdfunding rewards, campaigns consist of tiers that the investors will choose from. Each tier has its own name, short description, and minimum cost.

Some campaign information is stored on-chain. It is conceivable that this information could be moved to Gaia end-points controlled by the fundraisers at some point. 

A basic client implementation can be found in `src/stackstarterclient.js`.

This is a submission for the Clarity 2.0 hackathon.

## Features

The smart contract implements all features you would expect for online crowdfunding:

- Users can start campaigns and add a name, short description, a link, funding goal, and duration.
- The campaign owner can update the short description and link.
- The campaign owner creates tiers, each having a name, short description, and cost.
- Investors choose one or more tiers to invest. They are required to pay at least the tier cost in order for the investment to be successful.
- Investors can take their investment out as long as the campaign has not reached its funding goal.
- The campaign owner can collect the funds once the campaign is successfully funded. 

## Read-only functions

- `get-campaign-id-nonce`
  - Returns the current campaign ID nonce of the smart contract.
- `get-total-campaigns-funded`
  - Returns the amount of campaigns that were successfully funded.
- `get-total-investments`
  - Returns the total amount of investments. This number may go up and down a bit depending on refunds.
- `get-total-investment-value`
  - Returns the total amount of STX invested. This number may go up and down a bit depending on refunds.
- `get-campaign(campaign-id uint)`
  - Returns the campaign data for the specified campaign.
- `get-campaign-information(campaign-id uint)`
  - Returns the campaign information for the specified campaign (short description and link).
- `get-campaign-totals(campaign-id uint)`
  - Returns the campaign totals for the specified campaign (total investors and total investment).
- `get-campaign-status(campaign-id uint)`
  - Returns the current campaign status (whether the goal was reached, the block height it was reached if successful, and whether the campaign owner has collected the funds).
- `get-is-active-campaign(campaign-id uint)`
  - Returns whether the campaign is currently active (not expired and the funding goal has not yet been reached).
- `get-campaign-tier-nonce(campaign-id uint)`
  - Returns the current tier ID nonce for the specified campaign.
- `get-campaign-tier(campaign-id uint, tier-id uint)`
  - Returns the tier information for the specified tier.
- `get-campaign-tier-totals(campaign-id uint, tier-id uint)`
  - Returns the campaign tier totals for the specified tier (total investors and total investment).
- `get-campaign-tier-investment-amount(campaign-id uint, tier-id uint, investor principal)`
  - Returns the invested amount of an investor for the specified tier, defaults to `u0` if the investor has not invested.

## Public functions

- `create-campaign (name buff, description buff, link buff, goal uint, duration uint)`
  - Creates a new campaign with the provided information. Returns the campaign ID if successful.
- `update-campaign-information(campaign-id uint, description buff, link buff)`
  - Updates campaign information for the specified campaign. Only the owner can do this. Returns `u1` if successful.
- `add-tier (campaign-id uint, name buff, description buff, cost uint)`
  - Adds an investment tier to the specified campaign. Only the owner can do this. Returns the tier ID if successful.
- `invest(campaign-id uint, tier-id uint, amount uint)`
  - Invest an amount in the specified tier. This will transfer STX from the `tx-sender` to the contract. An investment is only successful if the campaign is still active and the investment amount is equal or larger than the tier cost.
- `refund(campaign-id uint, tier-id uint)`
  - Request a refund for the specified tier. This will transfer STX from the contract to the `tx-sender`. A refund will only be processed if the campaign is still active or expired (unsuccessful), and if the `tx-sender` has indeed invested in the specified tier.
- `collect(campaign-id uint)`
  - Collect the raised funds. This will transfer STX from the contract to the `tx-sender`. The campaign owner is the only one that can do this, and only if the campaign was successfully funded. 

# Testing

All tests are ran on mocknet to get around limitations of the current Clarity JS SDK (STX transfers and advancing blocks). A `mocknet.toml` file is provided in the `test` folder to make things easier. Download and build [stacks-blockchain](https://github.com/blockstack/stacks-blockchain), then run a mocknet node using the provided file:

```bash
cargo testnet start --config='/path/to/test/mocknet.toml'
```

There are two sets of tests: the "basic tests" cover specific function calls and the "scenarios" simulate two campaigns with multiple tiers and investors---one that is successful and one that is not).

To run all tests:

```bash
npm test
```

To run a particular test, specify the file:

```bash
npm test test/0-stackstarter.js
```

One can query the contract balance [using the local node](http://127.0.0.1:20443/v2/accounts/ST2ZRX0K27GW0SP3GJCEMHD95TQGJMKB7G9Y0X1MH.stackstarter?proof=0). Be sure to restart the mocknet node if you want to rerun the tests.

Since the tests rely on mocknet, they have to wait for blocks to be mined. It means that tests are slow and time-sensitive. Sit back and relax.