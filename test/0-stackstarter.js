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

describe('stackstarter basic tests',async () =>
	{
	let contract_owner = accounts[0];
	let user_a = accounts[1];
	let user_b = accounts[2];
	let mocknet;
	let stacks_node_api;
	let client_a;
	let client_b;
	let test_campaign_id;

	before(async () =>
		{
		mocknet = new StacksMocknet();
		stacks_node_api = mocknet.api;
		client_a = new StackstarterClient(contract_owner.stacksAddress,user_a,stacks_node_api);
		client_b = new StackstarterClient(contract_owner.stacksAddress,user_b,stacks_node_api);
		await mocknet.deploy_contract('./contracts/stackstarter.clar',contract_name,contract_owner);
		const new_campaign = {
			name: 'test campaign',
			description: 'test campaign description',
			link: 'https://test-campaign.local',
			goal: new BN('10000000'),
			duration: new BN('20000')
		};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		test_campaign_id = await client_a.get_total_campaigns();
		});

	it('can create a campaign',async () =>
		{
		const new_campaign = {
			name: 'name' + Math.random(),
			description: 'desc' + Math.random(),
			link: 'https://link' + Math.random(),
			goal: 100000 + (~~(Math.random()*100000)),
			duration: 100 + (~~(Math.random()*100))
			};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		const campaign_nonce = await stacks_node_api.call_read(contract_owner,contract_name,'get-campaign-id-nonce');
		assert.equal(getCVTypeString(campaign_nonce),'(responseOk uint)','campaign nonce is not a uint');
		const campaign_id = campaign_nonce.value.value;
		const campaign = await client_a.get_campaign(campaign_id);
		assert.notEqual(getCVTypeString(campaign),'(responseOk (optional none))','campaign does not exist');
		let data = campaign.value.value.data;
		assert.equal(cvToString(data.fundraiser),user_a.stacksAddress,'fundraiser address does not match');
		assert.equal(cvToString(data.name),'"'+new_campaign.name+'"','campaign name does not match');
		assert.equal(cvToString(data.goal),'u'+new_campaign.goal,'campaign goal does not match');
		const information = await client_a.get_campaign_information(campaign_id);
		assert.notEqual(getCVTypeString(information),'(responseOk (optional none))','campaign information does not exist');
		data = information.value.value.data;
		assert.equal(cvToString(data.description),'"'+new_campaign.description+'"','campaign description does not match');
		assert.equal(cvToString(data.link),'"'+new_campaign.link+'"','campaign name does not match');
		});

	it('owner can update the campaign information',async () =>
		{
		const new_information = {
			description: 'new desc' + Math.random(),
			link: 'https://newlink' + + Math.random()
			};
		await client_a.update_campaign_information(test_campaign_id,new_information);
		await mocknet.wait_n_blocks(1);
		const information = await client_a.get_campaign_information(test_campaign_id);
		assert.notEqual(getCVTypeString(information),'(responseOk (optional none))','campaign information does not exist');
		const data = information.value.value.data;
		assert.equal(cvToString(data.description),'"'+new_information.description+'"','new campaign description does not match');
		assert.equal(cvToString(data.link),'"'+new_information.link+'"','new campaign link does not match');
		});

	it('does not allow others to update the campaign information of a campaign they do not own',async () =>
		{
		const new_information = {
			description: 'new desc FAIL' + Math.random(),
			link: 'https://newlinkFAIL' + + Math.random()
			};
		await client_b.update_campaign_information(test_campaign_id,new_information);
		await mocknet.wait_n_blocks(1);
		const information = await client_b.get_campaign_information(test_campaign_id);
		assert.notEqual(getCVTypeString(information),'(responseOk (optional none))','Project information does not exist');
		const data = information.value.value.data;
		assert.notEqual(cvToString(data.description),'"'+new_information.description+'"','New campaign description matches when it should not');
		assert.notEqual(cvToString(data.link),'"'+new_information.link+'"','New campaign link matches when it should not');
		});

	it('reports if a campaign is active',async () =>
		{
		assert.isTrue(await client_a.get_is_active_campaign(test_campaign_id),'test campaign is not active');
		assert.isFalse(await client_a.get_is_active_campaign(new BN('99999999999999')),'bogus campaign should not be active, or this test has ran 99999999999999 times');
		});

	it('gives the sum of the total campaigns',async () =>
		{
		let current = await client_a.get_total_campaigns();
		await client_a.create_campaign({name:'a',description:'b',link:'c',goal:100,duration:100});
		await mocknet.wait_n_blocks(1);
		let next = await client_a.get_total_campaigns();
		assert.isTrue(current.add(new BN('1')).eq(next),'campaign count did not increment');
		});

	it('allows the owner to add a tier',async () =>
		{
		const new_tier = {
			campaign_id: test_campaign_id,
			name: 'name' + Math.random(),
			description: 'desc' + Math.random(),
			cost: 1000 + (~~(Math.random()*1000))
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(test_campaign_id);
		const tier = await client_a.get_campaign_tier(test_campaign_id,tier_id);
		assert.notEqual(getCVTypeString(tier),'(responseOk (optional none))');
		const data = tier.value.value.data;
		assert.equal(cvToString(data.name),'"'+new_tier.name+'"','Name does not match');
		assert.equal(cvToString(data.cost),'u'+new_tier.cost,'cost does not match');
		});

	it('does not allow others to add a tier to a campaign they do not own',async () =>
		{
		const current = await client_a.get_total_campaign_tiers(test_campaign_id);
		const new_tier = {
			campaign_id: test_campaign_id,
			name: 'nameFAIL',
			description: 'descFAIL',
			cost: 1000 + (~~(Math.random()*1000))
			};
		await client_b.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const next = await client_a.get_total_campaign_tiers(test_campaign_id);
		assert.isTrue(current.eq(next),'tier count did not stay the sane');
		});

	it('allows clients to invest in tiers',async () =>
		{
		const previous_total = await client_a.get_total_investment_value();
		const invest_amount = new BN('10000000');
		const new_tier = {
			campaign_id: test_campaign_id,
			name: 'nameIN',
			description: 'descIN',
			cost: invest_amount
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const previous_balance = await mocknet.balance(user_b);
		const tier_id = await client_a.get_total_campaign_tiers(test_campaign_id);
		await client_b.invest(test_campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(1);
		const new_total = await client_a.get_total_investment_value();
		assert.isTrue(new_total.sub(previous_total).eq(invest_amount),'investment total stayed the same');
		const totals = await client_a.get_campaign_tier_totals(test_campaign_id,tier_id);
		assert.notEqual(getCVTypeString(totals),'(responseOk (optional none))','tier totals do not exist');
		const data = totals.value.value.data;
		assert.isTrue(data['total-investment'].value.eq(invest_amount),'total-investment did not increase');
		assert.isTrue(data['total-investors'].value.eq(new BN('1')),'total-investors did not increment');
		const investment = await client_b.get_campaign_tier_investment_amount(test_campaign_id,tier_id,user_b);
		assert.isTrue(investment.eq(invest_amount),'principal investment amount did not increase');
		const new_balance = await mocknet.balance(user_b);
		assert.isTrue(previous_balance.sub(new_balance).gte(invest_amount),'user b balance did not decrease by at least the invest amount');
		});

	it('rejects the investment if the amount is too low',async () =>
		{
		const previous_total = await client_a.get_total_investment_value();
		const invest_amount = new BN('100');
		const new_tier = {
			campaign_id: test_campaign_id,
			name: 'nameLOW',
			description: 'descLOW',
			cost: new BN('10000')
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(test_campaign_id);
		await client_b.invest(test_campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(1);
		const new_total = await client_a.get_total_investment_value();
		assert.isTrue(new_total.eq(previous_total),'total investment increased');
		const totals = await client_a.get_campaign_tier_totals(test_campaign_id,tier_id);
		assert.notEqual(getCVTypeString(totals),'(responseOk (optional none))','tier totals do not exist');
		const data = totals.value.value.data;
		assert.isTrue(data['total-investment'].value.eq(new BN('0')),'total-investment increased');
		assert.isTrue(data['total-investors'].value.eq(new BN('0')),'total-investors incremented');
		const investment = await client_b.get_campaign_tier_investment_amount(test_campaign_id,tier_id,user_b);
		assert.isTrue(investment.eq(new BN('0')),'principal investment amount increased');
		});

	it('allows a client to refund a prior tier investment',async () =>
		{
		const new_campaign = {
			name: 'test campaign',
			description: 'test campaign description',
			link: 'https://test-campaign.local',
			goal: new BN('10000000'),
			duration: new BN('20000')
		};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		const campaign_id = await client_a.get_total_campaigns();
		const invest_amount = new BN('100000');
		const new_tier = {
			campaign_id: campaign_id,
			name: 'nameRE',
			description: 'descRE',
			cost: invest_amount
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
		await client_b.invest(campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(1);
		const previous_balance = await mocknet.balance(user_b);
		await client_b.refund(campaign_id,tier_id);
		await mocknet.wait_n_blocks(1);
		const new_balance = await mocknet.balance(user_b);
		const totals = await client_a.get_campaign_tier_totals(campaign_id,tier_id);
		assert.notEqual(getCVTypeString(totals),'(responseOk (optional none))','tier totals do not exist');
		const data = totals.value.value.data;
		assert.isTrue(data['total-investment'].value.eq(new BN('0')),'total-investment is not zero');
		assert.isTrue(data['total-investors'].value.eq(new BN('0')),'total-investors is not zero');
		const investment = await client_b.get_campaign_tier_investment_amount(campaign_id,tier_id,user_b);
		assert.isTrue(investment.eq(new BN('0')),'principal investment amount is not zero');
		assert.isTrue(new_balance.gt(previous_balance),'user did not get investment back');
		});

	it('allows the owner to collect the raised amount when the target is reached in time',async () =>
		{
		const new_campaign = {
			name: 'nameFUND' + Math.random(),
			description: 'descFUND' + Math.random(),
			link: 'https://link' + Math.random(),
			goal: new BN('1000'),
			duration: 5
			};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		const campaign_id = await client_a.get_total_campaigns();
		const invest_amount = new BN('2000');
		const new_tier = {
			campaign_id: campaign_id,
			name: 'nameRE' + Math.random(),
			description: 'descRE' + Math.random(),
			cost: invest_amount
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
		await client_b.invest(campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(4); // beyond the duration
		const previous_balance = await mocknet.balance(contract_owner.stacksAddress+'.'+contract_name);
		await client_a.collect(campaign_id);
		await mocknet.wait_n_blocks(1);
		const new_balance = await mocknet.balance(contract_owner.stacksAddress+'.'+contract_name);
		assert.isTrue(previous_balance.gt(new BN('0')),'previous balance is zero');
		assert.isTrue(previous_balance.sub(new_balance).eq(invest_amount));
		const status = await client_a.get_campaign_status(campaign_id);
		assert.notEqual(getCVTypeString(status),'(responseOk (optional none))','campaign status does not exist');
		const data = status.value.value.data;
		assert.equal(data['target-reached'].type,ClarityType.BoolTrue,'target-reached is false');
		assert.isTrue(data['target-reached-height'].value.gt(new BN('0')),'target-reached-height is zero');
		assert.equal(data['funded'].type,ClarityType.BoolTrue,'funded is false');
		});

	it('does not allow the owner to collected the raised amount before the goal is reached',async () =>
		{
		const new_campaign = {
			name: 'nameLONG' + Math.random(),
			description: 'descLONG' + Math.random(),
			link: 'https://link' + Math.random(),
			goal: new BN('5000'),
			duration: 50000
			};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		const campaign_id = await client_a.get_total_campaigns();
		const invest_amount = new BN('2000');
		const new_tier = {
			campaign_id: campaign_id,
			name: 'nameRE' + Math.random(),
			description: 'descRE' + Math.random(),
			cost: invest_amount
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
		await client_b.invest(campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(1);
		await client_a.collect(campaign_id);
		const status = await client_a.get_campaign_status(campaign_id);
		assert.notEqual(getCVTypeString(status),'(responseOk (optional none))','campaign status does not exist');
		const data = status.value.value.data;
		assert.equal(data['target-reached'].type,ClarityType.BoolFalse,'target-reached is true');
		assert.isFalse(data['target-reached-height'].value.gt(new BN('0')),'target-reached-height is not zero');
		assert.equal(data['funded'].type,ClarityType.BoolFalse,'funded is true');
		});

	it('does not allow clients to refund their investment after the goal was reached',async () =>
		{
		const new_campaign = {
			name: 'nameFUNDN' + Math.random(),
			description: 'descFUNDN' + Math.random(),
			link: 'https://link' + Math.random(),
			goal: new BN('1000'),
			duration: 5
			};
		await client_a.create_campaign(new_campaign);
		await mocknet.wait_n_blocks(1);
		const campaign_id = await client_a.get_total_campaigns();
		const invest_amount = new BN('2000');
		const new_tier = {
			campaign_id: campaign_id,
			name: 'nameREN' + Math.random(),
			description: 'descREN' + Math.random(),
			cost: invest_amount
			};
		await client_a.add_tier(new_tier);
		await mocknet.wait_n_blocks(1);
		const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
		await client_b.invest(campaign_id,tier_id,invest_amount);
		await mocknet.wait_n_blocks(4); // beyond the duration
		const previous_balance = await mocknet.balance(user_b);
		const status = await client_a.get_campaign_status(campaign_id);
		assert.notEqual(getCVTypeString(status),'(responseOk (optional none))','campaign status does not exist');
		const data = status.value.value.data;
		assert.equal(data['target-reached'].type,ClarityType.BoolTrue,'target-reached is false');
		assert.isTrue(data['target-reached-height'].value.gt(new BN('0')),'target-reached-height is zero');
		assert.equal(data['funded'].type,ClarityType.BoolFalse,'funded is true');
		await client_b.refund(test_campaign_id,tier_id);
		await mocknet.wait_n_blocks(1);
		const current_balance = await mocknet.balance(user_b);
		assert.isTrue(current_balance.sub(previous_balance).lt(invest_amount),'user should not have received investment back');
		});
	}).timeout(0);
