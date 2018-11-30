const Message = require('../models/message');
const Channel = require('../models/channel');
const User = require('../models/user');
const {trySendMessage, tryClose} = require('./utils');

let simpleErrorMessage = (message) => JSON.stringify({
    eventType: 'onError',
    channelId: null,
    data: message,
    sender: 'Admin',
    timestamp: new Date()
});


/**
 * 
 * @param {WebSocket} ws 
 */
function noUsernameError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage('Please provide a username in the request\'s query parameters'));
    tryClose(ws, 1008, 'Please provide a username in the request\'s query parameters');
}

function usernameInUseError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage('Username already in use! Please reconnect using a different username'));
    tryClose(ws, 1008, 'Username already in use! Please reconnect using a different username');
}

function reservedUsernameError(ws) {
    const message = 'That username is not valid! Please reconnect using a different username.';
    trySendMessage(new User(null, ws), simpleErrorMessage(message));
    tryClose(ws, 1008, message);
}

function nonExistingChannelError(ws, id) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`The channel with id ${id} does not exist`));
}

function cannotLeaveThisChannelError(ws, name) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`I'm sorry, but you can't leave the channel "${name}"`));
}

function noMessageError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`You have to provide a message in the payload's data property...`));
}

function noChannelNameError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`You have to provide a channel name in the payload's data property...`));
}

function channelNameLengthError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`The channel's name must be between 5 and 20 characters!`));
}

function channelAlreadyExistError(ws, name) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`The channel with name "${name}" already exists.`));
}

function wrongWayAroundError(ws) {
    trySendMessage(new User(null, ws), simpleErrorMessage(`You've got this the wrong way around, friend. I'm the one supposed to send you this event, not the other way around!`));
}

function wrongPasswordError(ws, name){
    trySendMessage(new User(null, ws), simpleErrorMessage(`The password you entered to join the channel ${name} is incorrect!`));
}

function passwordRequiredError(ws, name){
    trySendMessage(new User(null, ws), simpleErrorMessage(`You must send a password to join the channel ${name}!`));
}
module.exports = {
    noUsernameError,
    usernameInUseError,
    reservedUsernameError,
    nonExistingChannelError,
    cannotLeaveThisChannelError,
    noMessageError,
    noChannelNameError,
    channelNameLengthError,
    channelAlreadyExistError,
    wrongWayAroundError,
    wrongPasswordError,
    passwordRequiredError
};