const {assert} = require("chai");

const {readFileSync} = require('fs');

const
	{
	cvToString,
	getCVTypeString,
	ClarityType
	} = require('@blockstack/stacks-transactions');

const BN = require('bn.js');

const StackstarterClient = require('../src/stackstarterclient');
const StacksMocknet = require('../src/stacksmocknet');

const accounts = require('./accounts.json');

const contract_name = 'stackstarter';

const CONSOLE_LOG = false;

describe('stackstarter scenarios',async () =>
	{
	let contract_owner = accounts[0];
	let user_a = accounts[1];
	let user_b = accounts[2];
	let user_c = accounts[3];
	let mocknet;
	let stacks_node_api;
	let client_a;
	let client_b;
	let client_c;

	let current_campaign_id;
	let current_tier1_id;
	let current_tier2_id;
	let current_tier3_id;

	const campaign_goal = new BN('50000');
	const tier1_cost = new BN('10000');
	const tier2_cost = new BN('20000');
	const tier3_cost = new BN('30000');

	let campaign_counter = 0;

	let duration = 10; // this has to increase if the tests grow in size.

	before(async () =>
		{
		mocknet = new StacksMocknet();
		stacks_node_api = mocknet.api;
		client_a = new StackstarterClient(contract_owner.stacksAddress,user_a,stacks_node_api);
		client_b = new StackstarterClient(contract_owner.stacksAddress,user_b,stacks_node_api);
		client_c = new StackstarterClient(contract_owner.stacksAddress,user_c,stacks_node_api);
		await mocknet.deploy_contract('./contracts/stackstarter.clar',contract_name,contract_owner);
		});

	beforeEach(async () =>
		{
		++campaign_counter;
		CONSOLE_LOG && console.log('Creating campaign');
		const campaign = {
			name: 'test campaign '+campaign_counter,
			description: 'test campaign description '+campaign_counter,
			link: 'https://test-campaign'+campaign_counter+'.local',
			goal: campaign_goal,
			duration: duration
		};
		await client_a.create_campaign(campaign);
		await mocknet.wait_n_blocks(1);
		current_campaign_id = await client_a.get_total_campaigns();
		const tier1 = {
			campaign_id: current_campaign_id,
			name: 'test tier 1',
			description: 'test tier 1 description',
			cost: tier1_cost
			};
		const tier2 = {
			campaign_id: current_campaign_id,
			name: 'test tier 2',
			description: 'test tier 2 description',
			cost: tier2_cost
			};
		const tier3 = {
			campaign_id: current_campaign_id,
			name: 'test tier 3',
			description: 'test tier 3 description',
			cost: tier3_cost
			};
		CONSOLE_LOG && console.log('Creating tiers');
		await client_a.add_tier(tier1);
		await mocknet.wait_n_blocks(1);
		current_tier1_id = await client_a.get_total_campaign_tiers(current_campaign_id);
		await client_a.add_tier(tier2);
		await mocknet.wait_n_blocks(1);
		current_tier2_id = await client_a.get_total_campaign_tiers(current_campaign_id);
		await client_a.add_tier(tier3);
		await mocknet.wait_n_blocks(1);
		current_tier3_id = await client_a.get_total_campaign_tiers(current_campaign_id);
		});

	it('successfully funded campaign with multiple tiers and investors',async () =>
		{
		await client_b.invest(current_campaign_id,current_tier1_id,tier1_cost);
		await mocknet.wait_n_blocks(1);
		await client_b.invest(current_campaign_id,current_tier2_id,tier2_cost);
		await mocknet.wait_n_blocks(1);
		await client_c.invest(current_campaign_id,current_tier3_id,tier3_cost);
		await mocknet.wait_n_blocks(1);
		let expected_total_investment = (new BN('0')).add(tier1_cost).add(tier2_cost).add(tier3_cost);

		const totals = await client_a.get_campaign_totals(current_campaign_id);
		let data = totals.value.value.data;
		assert.equal(cvToString(data['total-investment']),'u'+expected_total_investment.toString(),'campaign total does not match');
		assert.equal(cvToString(data['total-investors']),'u3','total investors does not match');

		const previous_balance = await mocknet.balance(user_a);

		CONSOLE_LOG && console.log('waiting to reach target height');

		while (await client_a.get_is_active_campaign(current_campaign_id))
			await mocknet.wait_n_blocks(1);

		CONSOLE_LOG && console.log('target height reached');

		await client_a.collect(current_campaign_id);
		await mocknet.wait_n_blocks(1);

		const new_balance = await mocknet.balance(user_a);
		assert.isTrue(new_balance.gte(previous_balance),'fundraiser did not receive funds');
		});

	it('failed campaign with multiple tiers and investors, investors can get their money back',async () =>
		{
		await client_b.invest(current_campaign_id,current_tier1_id,tier1_cost);
		await mocknet.wait_n_blocks(1);
		await client_c.invest(current_campaign_id,current_tier2_id,tier2_cost);
		await mocknet.wait_n_blocks(1);
		let expected_total_investment = (new BN('0')).add(tier1_cost).add(tier2_cost);

		const totals = await client_a.get_campaign_totals(current_campaign_id);
		let data = totals.value.value.data;
		assert.equal(cvToString(data['total-investment']),'u'+expected_total_investment.toString(),'campaign total does not match');
		assert.equal(cvToString(data['total-investors']),'u2','total investors does not match');

		const owner_previous_balance = await mocknet.balance(user_a);
		const investor1_previous_balance = await mocknet.balance(user_b);
		const investor2_previous_balance = await mocknet.balance(user_c);

		CONSOLE_LOG && console.log('waiting to reach target height');

		while (await client_a.get_is_active_campaign(current_campaign_id))
			await mocknet.wait_n_blocks(1);

		CONSOLE_LOG && console.log('target height reached');

		await client_a.collect(current_campaign_id);
		await mocknet.wait_n_blocks(1);

		const owner_new_balance = await mocknet.balance(user_a);
		assert.isTrue(owner_new_balance.lte(owner_previous_balance),'fundraiser should not have received funds');

		await client_b.refund(current_campaign_id,current_tier1_id);
		await mocknet.wait_n_blocks(1);

		await client_c.refund(current_campaign_id,current_tier2_id);
		await mocknet.wait_n_blocks(1);

		const investor1_new_balance = await mocknet.balance(user_b);
		const investor2_new_balance = await mocknet.balance(user_c);

		assert.isTrue(investor1_new_balance.gt(investor1_previous_balance),'investor 1 did not receive refund');
		assert.isTrue(investor2_new_balance.gt(investor2_previous_balance),'investor 2 did not receive refund');
		});
	}).timeout(0);
