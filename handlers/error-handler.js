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

function nonExistingChannelError(ws, id) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`The channel with id ${id} does not existing`));
}
function noMessageError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`You have to provide a message in the payload's data property...`));
}
function wrongWayAroundError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`You've got this the wrong way around, friend. I'm the one supposed to send you this event, not the other way around!`));
}

module.exports = {
    noUsernameError,
    usernameInUseError,
    nonExistingChannelError,
    noMessageError,
    wrongWayAroundError
};