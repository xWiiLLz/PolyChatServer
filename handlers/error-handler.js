const Message = require('../models/message');
const Channel = require('../models/channel');
const User = require('../models/user');
const {trySendMessage, tryClose} = require('./utils');

let simpleErrorMessage = (message) => JSON.stringify(new Message('onError', null, message, 'Admin', new Date())); 


/**
 * 
 * @param {WebSocket} ws 
 */
function noUsernameError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage('Please provide a username in the request\'s query parameters'));
    tryClose(1008, 'Please provide a username in the request\'s query parameters');
}

function usernameInUseError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage('Username already in use! Please reconnect using a different username'));
    tryClose(1008, 'Username already in use! Please reconnect using a different username');
}

function nonExistingChannel(ws, id) {
    ws.send(simpleErrorMessage(`The channel with id ${id} does not existing`));
}

function noMessageError(ws) {

}

module.exports = {
    noUsernameError,
    usernameInUseError,
    nonExistingChannel
};