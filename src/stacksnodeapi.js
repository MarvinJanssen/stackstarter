const
	{
	deserializeCV
	} = require('@blockstack/stacks-transactions');

function StacksNodeApi(network)
	{
	this.network = network;
	}

/**
 * Returns the stacks node info object
 * @throws {Error} If the call fails.
 * @return {object}
 */
StacksNodeApi.prototype.info = async function()
	{
	let response = await fetch(`${this.network.coreApiUrl}/v2/info`,{method:'get',headers:{'content-type':'application/json'}});
	if (response.ok)
		return (await response.json());
	throw new Error(response.status+' '+response.statusText);
	};

/**
 * Reads account information and returns it as an object.
 * @param  {string} principal
 * @throws {Error} If the call to the stacks node or JSON parsing fails.
 * @return {object}
 */
StacksNodeApi.prototype.account = async function(principal)
	{
	const response = await fetch(this.network.getAccountApiUrl(principal.stacksAddress || principal),{method:'get',headers:{'content-type':'application/json'}});
	if (response.ok)
		return response.json();
	throw new Error(response.status+' '+response.statusText);
	};

/**
 * Calls a read-only Clarity function
 * @param  {string} address
 * @param  {string} contract_name
 * @param  {string} function_name
 * @param  {object} args          {sender:'tx-sender',arguments:[list of ClarityValue objects]}
 * @throws {Error} If the call fails.
 * @return {object}               Deserialized result
 */
StacksNodeApi.prototype.call_read = async function(address,contract_name,function_name,args)
	{
	let response = await fetch(this.network.getReadOnlyFunctionCallApiUrl(address.stacksAddress || address,contract_name,function_name),{method:'post',headers:{'content-type':'application/json'},body:JSON.stringify(args || {sender:address.stacksAddress || address,arguments:[]})});
	if (response.ok)
		{
		response = await response.json();
		if (response.okay)
			return deserializeCV(Buffer.from(response.result.substr(2),'hex'));
		throw new Error(response.cause);
		}
	throw new Error(response.status+' '+response.statusText);
	};

/**
 * Returns the source code of a Clarity contract.
 * @param  {string} address
 * @param  {string} contract_name
 * @throws {Error} If the call fails.
 * @return {string}
 */
StacksNodeApi.prototype.source = async function(address,contract_name)
	{
	let response = await fetch(`${this.network.coreApiUrl}/v2/contracts/source/${address.stacksAddress || address}/${contract_name}?proof=0`,{method:'get',headers:{'content-type':'application/json'}});
	if (response.ok)
		return (await response.json()).source;
	throw new Error(response.status+' '+response.statusText);
	};

/**
 * Reads a map entry of a smart contract for a specific key.
 * @param  {string} address
 * @param  {string} contract_name
 * @param  {string} map_name
 * @param  {object} key
 * @throws {Error} If the call fails.
 * @return {ClarityValue}
 */
StacksNodeApi.prototype.map_entry = async function(address,contract_name,map_name,key)
	{
	let response = await fetch(`${this.network.coreApiUrl}/v2/map_entry/source/${address.stacksAddress || address}/${contract_name}?proof=0`,{method:'post',headers:{'content-type':'application/json'},body:JSON.stringify(key)});
	if (response.ok)
		return deserializeCV(Buffer.from(response.data.substr(2),'hex'));
	throw new Error(response.status+' '+response.statusText);
	};

module.exports = StacksNodeApi;
