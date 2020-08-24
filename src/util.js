const
	{
	serializeCV
	} = require('@blockstack/stacks-transactions');

const BN = require('bn.js');

/**
 * Converts a hex string to BN. Removes '0x' at the start of the string if found.
 * @param  {string} hex
 * @throws {Error} If hex is not a string.
 * @return {BN}
 */
function hex2bn(hex)
	{
	if (typeof hex !== 'string')
		throw new Error('toBN only accepts a string');
	return new BN(hex[0] === '0' && hex[1] === 'x' ? hex.substr(2) : hex,16);
	}

/**
 * Converts a CV to hex string
 * @param  {ClarityValue} cv
 * @return {string}
 */
function cv2hex(cv)
	{
	return '0x'+serializeCV(cv).toString('hex');
	}

module.exports = {
	hex2bn,
	cv2hex
};