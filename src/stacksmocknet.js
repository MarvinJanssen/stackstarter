const BLOCK_TIME = 5000;

const {readFileSync} = require('fs');

const StacksNodeApi = require('./stacksnodeapi');

const
	{
	makeContractDeploy,
	StacksTestnet,
	broadcastTransaction
	} = require('@blockstack/stacks-transactions');

const
	{
	hex2bn,
	cv2hex
	} = require('../src/util');

const BN = require('bn.js');

const wait = ms => new Promise(resolve => setTimeout(resolve,ms)); 

/**
 * Simple Mocknet interface that exposes some helper functions.
 */
function StacksMocknet()
	{
	this.network = new StacksTestnet();
	this.network.coreApiUrl = 'http://127.0.0.1:20443';
	this.api = new StacksNodeApi(this.network);
	}

/**
 * Returns the balance of a principal as a BN. Returns BN(0) for nonexistent principals.
 * @param  {string} principal
 * @throws {Error} If the principal format is invalid.
 * @return {BN}
 */
StacksMocknet.prototype.balance = async function(principal)
	{
	try
		{
		return hex2bn((await this.api.account(principal.stacksAddress || principal)).balance);
		}
	catch (error)
		{
		if (error.message === '400 Bad Request')
			return new BN('0');
		throw error;
		}
	};

/**
 * Deploys a contract and waits for confirmation.
 * @param  {string} file    path to the Clarity file.
 * @param  {string} name    name to use for deploymeny.
 * @param  {object} account principal deploying the contract.
 * @throws {Error} If the call fails or if the deployment times out (20 seconds).
 * @return {bool}
 */
StacksMocknet.prototype.deploy_contract = async function(file,name,account)
	{
	const tx_options = {
		contractName: name,
		codeBody: readFileSync(file,'utf8'),
		senderKey: account.secretKey,
		network: this.network
		};
	const transaction = await makeContractDeploy(tx_options);
	const txid = await broadcastTransaction(transaction,this.network);
	const timeout = +new Date() + 20000;
	while (+new Date() <= timeout)
		{
		await wait(250);
		try
			{
			return (await this.api.source(account.stacksAddress,tx_options.contractName)) === tx_options.codeBody;
			}
		catch (error)
			{
			if (error.message.substr(0,25) !== 'Unchecked(NoSuchContract(' && error.message.substr(0,3) !== '404')
				throw error;
			continue;
			}
		}
	throw new Error('deploy_contract timeout');
	};

StacksMocknet.prototype.wait_n_blocks = async function(n,hide_progress)
	{
	var target_height = (await this.api.info()).stacks_tip_height + n;
	var timeout = +new Date() + (n+5)*BLOCK_TIME;
	while (+new Date() <= timeout)
		{
		let current_height = (await this.api.info()).stacks_tip_height;
		if (!hide_progress)
			process.stdout.write('\033[0Gwaiting for block '+(n-(target_height-current_height))+'/'+n);
		if (current_height >= target_height)
			{
			if (!hide_progress)
				process.stdout.write('\033[0G                         \033[0G');
			return true;
			}
		await wait(500);
		}
	throw new Error('wait_n_blocks timeout');
	};

module.exports = StacksMocknet;
