const
	{
	bufferCVFromString,
	uintCV,
	//principalCV, // not exported by @blockstack/stacks-transactions
	standardPrincipalCV,
	contractPrincipalCV,
	makeContractCall,
	deserializeCV,
	broadcastTransaction,
	makeStandardSTXPostCondition,
	makeContractSTXPostCondition,
	FungibleConditionCode,
	ClarityType
	} = require('@blockstack/stacks-transactions');

const BN = require('bn.js');

const
	{
	hex2bn,
	cv2hex
	} = require('../src/util');

function principalCV(principal)
	{
	if (!principal.includes('.'))
		return standardPrincipalCV(principal);
	const [address,contractName] = principal.split('.');
	return contractPrincipalCV(address,contractName);
	}

function StackstarterClient(contract_address,account,stacks_node_api)
	{
	this.contract_name = 'stackstarter';
	this.contract_address = contract_address;
	this.account = account || {};
	this.api = stacks_node_api;
	this.network = stacks_node_api.network;
	this.validate_with_abi = true;
	}

StackstarterClient.prototype.get_campaign = async function(campaign_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id))]});
	};

StackstarterClient.prototype.get_campaign_information = async function(campaign_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign-information',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id))]});
	};

StackstarterClient.prototype.get_campaign_status = async function(campaign_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign-status',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id))]});
	};

StackstarterClient.prototype.get_campaign_totals = async function(campaign_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign-totals',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id))]});
	};

async function read_only_uint(function_name,args,def)
	{
	try
		{
		let response = await this.api.call_read(this.contract_address,this.contract_name,function_name,{sender:this.account.stacksAddress,arguments:args || []});
		if (response && response.type === ClarityType.ResponseOk && response.value.type === ClarityType.UInt)
			return response.value.value;
		return def || (new BN('0'));
		}
	catch (error)
		{
		if (error.message === '400 Bad Request')
			return def || (new BN('0'));
		throw error;
		}
	}

StackstarterClient.prototype.get_total_campaigns = async function()
	{
	return await read_only_uint.call(this,'get-campaign-id-nonce');
	};

StackstarterClient.prototype.get_total_campaigns_funded = async function()
	{
	return await read_only_uint.call(this,'get-total-campaigns-funded');
	};

StackstarterClient.prototype.get_total_investments = async function()
	{
	return await read_only_uint.call(this,'get-total-investments');
	};

StackstarterClient.prototype.get_total_investment_value = async function()
	{
	return await read_only_uint.call(this,'get-total-investment-value');
	};

StackstarterClient.prototype.get_total_campaign_tiers = async function(campaign_id)
	{
	return await read_only_uint.call(this,'get-campaign-tier-nonce',[cv2hex(uintCV(campaign_id))]);
	};

StackstarterClient.prototype.get_campaign_tier = async function(campaign_id,tier_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign-tier',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id)),cv2hex(uintCV(tier_id))]});
	};

StackstarterClient.prototype.get_campaign_tier_totals = async function(campaign_id,tier_id)
	{
	return await this.api.call_read(this.contract_address,this.contract_name,'get-campaign-tier-totals',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id)),cv2hex(uintCV(tier_id))]});
	};

StackstarterClient.prototype.get_campaign_tier_investment_amount = async function(campaign_id,tier_id,who)
	{
	return await read_only_uint.call(this,'get-campaign-tier-investment-amount',[cv2hex(uintCV(campaign_id)),cv2hex(uintCV(tier_id)),cv2hex(principalCV(who.stacksAddress || who))]);
	};

StackstarterClient.prototype.get_is_active_campaign = async function(campaign_id)
	{
	let response = await this.api.call_read(this.contract_address,this.contract_name,'get-is-active-campaign',{sender:this.account.stacksAddress,arguments:[cv2hex(uintCV(campaign_id))]});
	if (response && response.type === ClarityType.ResponseOk && (response.value.type === ClarityType.BoolTrue || response.value.type === ClarityType.BoolFalse))
		return response.value.type === ClarityType.BoolTrue;
	return false;
	};

async function broadcast_contract_call(function_name,args,post_conditions)
	{
	const txo = {
		contractAddress: this.contract_address,
		contractName: this.contract_name,
		functionName: function_name,
		functionArgs: args,
		senderKey: this.account.secretKey,
		validateWithAbi: this.validate_with_abi,
		network: this.network,
		postConditions: post_conditions || undefined
		};
	const tx = await makeContractCall(txo);
	return await broadcastTransaction(tx,this.network);
	}

StackstarterClient.prototype.create_campaign = async function(campaign)
	{
	if (typeof campaign !== 'object' || !campaign.name || !campaign.description || !campaign.link || !campaign.goal || !campaign.duration)
		return null;
	return await broadcast_contract_call.call(this,'create-campaign',[bufferCVFromString(campaign.name),bufferCVFromString(campaign.description),bufferCVFromString(campaign.link),uintCV(campaign.goal),uintCV(campaign.duration)]);
	};

StackstarterClient.prototype.update_campaign_information = async function(campaign_id,new_information)
	{
	if (typeof new_information !== 'object' || !new_information.description || !new_information.link)
		return null;
	return await broadcast_contract_call.call(this,'update-campaign-information',[uintCV(campaign_id),bufferCVFromString(new_information.description),bufferCVFromString(new_information.link)]);
	};

StackstarterClient.prototype.add_tier = async function(tier)
	{
	if (typeof tier !== 'object' || !tier.campaign_id || !tier.name || !tier.description || !tier.cost)
		return null;
	return await broadcast_contract_call.call(this,'add-tier',[uintCV(tier.campaign_id),bufferCVFromString(tier.name),bufferCVFromString(tier.description),uintCV(tier.cost)]);
	};

StackstarterClient.prototype.invest = async function(campaign_id,tier_id,amount)
	{
	const condition = makeStandardSTXPostCondition(this.account.stacksAddress,FungibleConditionCode.Equal,amount);
	return await broadcast_contract_call.call(this,'invest',[uintCV(campaign_id),uintCV(tier_id),uintCV(amount)],[condition]);
	};

StackstarterClient.prototype.refund = async function(campaign_id,tier_id)
	{
	const condition = makeContractSTXPostCondition(this.contract_address,this.contract_name,FungibleConditionCode.Greater,new BN('0'));
	return await broadcast_contract_call.call(this,'refund',[uintCV(campaign_id),uintCV(tier_id)],[condition]);
	};

StackstarterClient.prototype.collect = async function(campaign_id)
	{
	const condition = makeContractSTXPostCondition(this.contract_address,this.contract_name,FungibleConditionCode.Greater,new BN('0'));
	return await broadcast_contract_call.call(this,'collect',[uintCV(campaign_id)],[condition]);
	};

module.exports = StackstarterClient;
