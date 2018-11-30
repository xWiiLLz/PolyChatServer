'use strict';

const queryString = require('query-string');
const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const Channel = require('./models/channel');
const Message = require('./models/message');
const User = require('./models/user');
const {commands} = require('./handlers/commands');
const {trySendMessage, tryClose, limitedLengthArray} = require('./handlers/utils');
const Peer = require('simple-peer');
const wrtc = require('wrtc');
const bcrypt = require('bcrypt');

const { noUsernameError, usernameInUseError, reservedUsernameError, nonExistingChannelError, cannotLeaveThisChannelError, noMessageError, noChannelNameError, channelNameLengthError, channelAlreadyExistError, wrongWayAroundError, wrongPasswordError, passwordRequiredError } = require('./handlers/error-handler');
 
const wss = new WebSocket.Server({ port: 3005, path: '/chatservice' });
 
let clients = new Map();

let defaultChannels = [
    new Channel(uuidv1(), 'Général', null, true, limitedLengthArray(100)),
    new Channel(uuidv1(), 'Équipe 1', null, false, limitedLengthArray(100)),
    new Channel(uuidv1(), 'Équipe 2', null, false, limitedLengthArray(100)),
];

/* Socket events */
const onMessage = (payload, user) => {
    const {data, channelId} = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }

    if (!data) {
        return noMessageError(user.client);
    }

    const targettedChannel = channels.get(channelId);
    const timestamp = new Date();

    if (commands.has(data.toLowerCase())) {
        const command = commands.get(data.toLowerCase());
        if (command && command.execute)
            return command.execute(user, {
                targettedChannel: {
                    ...targettedChannel,
                    channelId
                },
                defaultChannels,
                channels,
                updateAllChannelsList,
                userPreferences
            });
    }

    const message = JSON.stringify(
        {
            eventType: 'onMessage',
            channelId,
            data,
            sender: user.username,
            timestamp
        });
    targettedChannel.messages.push(new Message('onMessage', channelId, data, user.username, timestamp));

    for (let [username, client] of targettedChannel.clients) {
        trySendMessage(new User(username, client), message);
    }
};

const emitOnGetChannel = (channelId, user) => {
    const channel = channels.get(channelId);
    const mappedChannel = {
        id: channelId,
        name: channel.name,
        messages: channel.messages
    };
    const message = JSON.stringify(
        {
            eventType: 'onGetChannel',
            channelId,
            data: mappedChannel,
            sender: 'Admin',
            timestamp: new Date()
        });
    trySendMessage(user, message);
};

const onGetChannel = (payload, user) => {
    const {channelId} = payload;

    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }
    emitOnGetChannel(channelId, user);
};

const onCreateChannel = (payload, user) => {
    const { data : {channelName, password} } = payload;
    if (!data || !channelName) {
        return noChannelNameError(user.client);
    }

    if (channelName.length < 5 || channelName.length > 20) {
        return channelNameLengthError(user.client);
    }

    for (let [channelId, channel] of channels) {
        if (channel.name === data) {
            return channelAlreadyExistError(user.client, channel.name);
        }
    }

    let uuid;
    do {
        uuid = uuidv1();
    } while(channels.has(uuid));

    if(!password || password.length <= 0) {
        channels.set(uuid, {
            ...new Channel(uuid, channelName, null, true, limitedLengthArray(100)),
            clients: new Map(),
            vocalClients: new Map()
        });
        updateAllChannelsList();
        return;
    }
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {
            channels.set(uuid, {
                ...new Channel(uuid, channelName, hash, true, limitedLengthArray(100)),
                clients: new Map(),
                vocalClients: new Map()
            });
            updateAllChannelsList();
        });
    });
};

let spammers = new Map();

const onJoinChannel = (payload, user) => {
    const { channelId,  data : {password} } = payload;

    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }

    const channel = channels.get(channelId);
    if (channel && channel.clients.has(user.username)) {
        console.log(`User ${user.username} tried to join channel that he already joined...`);
        let count = 0;
        if (spammers.has(user.username)) {
            count = spammers.get(user.username);
        }
        spammers.set(user.username, ++count);
        if (count > 5) {
            spammers.set(user.username, 0);
            tryClose(user.client, 1008, 'Please don\'t spam the server.');
        }
        return;
    }
    if(!channel.password || channel.password.length <= 0) {
        addClientToChannel(user, channelId);
        // Notify all channel's users
        for (let [username, client] of channel.clients) {
            updateChannelsList(null, new User(username, client));
        }
        return;
    }
    if(!password || password.length <= 0){
        return passwordRequiredError(user.client, channel.name);
    }
    bcrypt.compare(password, channel.password, function(err, res) {
        if(!res){
            return wrongPasswordError(user.client, channel.name);
        }
        addClientToChannel(user, channelId);
        // Notify all channel's users
        for (let [username, client] of channel.clients) {
            updateChannelsList(null, new User(username, client));
        }
    });

};


/**
 *
 * @param payload - Deserialized message received from the socket
 * @param user - Object containing
 */
const onLeaveChannel = (payload, user) => {
    const { channelId } = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }
    const channel = channels.get(channelId);
    if (channel.name === 'Général') {
        return cannotLeaveThisChannelError(user.client, channel.name);
    }

    // Notify all channel's users
    removeClientFromChannel(user, channelId);
    updateChannelsList(null, user);
    for (let [username, client] of channel.clients) {
        updateChannelsList(null, new User(username, client));
    }
};

const onJoinVocalChannel = (payload, user) => {
    const {
        channelId,
        data
    } = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }

    const channel = channels.get(channelId);
    if (channel && channel.vocalClients.has(user.username) && data && data.signal) {
        // console.log(`Received post-connection signal ${signal}`);
        const {peer} = channel.vocalClients.get(user.username);
        if (!peer) {
            console.error(`Could not find the peer for username ${user.username}`);
            return;
        }
        peer.signal(data.signal);
        return;
    }

    addClientToVocalChannel(data, user, channelId);
};

const onLeaveVocalChannel = (payload, user) => {
    const { channelId } = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(user.client, channelId);
    }

    removeClientFromVocalChannel(user, channelId);
};

const updateChannelsList = (payload, user) => {
    const message = JSON.stringify(
        {
            eventType: 'updateChannelsList',
            channelId: null,
            data: Array.from(channels).map(x => {
                const {id, name, password, clients} = x[1];
                return {id, name, joinStatus: clients.has(user.username), isPasswordProtected : password && password.length > 0 , messages: null, numberOfUsers: clients.size}
            }),
            sender: 'Admin',
            timestamp: new Date()
        });
    trySendMessage(user, message);
};

const onError = (payload, user) => {
    return wrongWayAroundError(user.client);
};

const supportedEvents = {
    onMessage,
    onGetChannel,
    onCreateChannel,
    onJoinChannel,
    onLeaveChannel,
    updateChannelsList,
    onError,
    onJoinVocalChannel,
    onLeaveVocalChannel,
    // onVoice
};

let channels = new Map(defaultChannels.map(ch => [
    ch.id, 
    {
        ...ch,
        clients: new Map(),
        vocalClients: new Map()
    }
]));

let ips = new Map();
let userPreferences = new Map();

wss.on('connection', (ws, request) => {
    // Initialization


    const { url } = request;
    // console.count(`Client trying to connect with url ${url}`);
    const parsedUrl = queryString.parseUrl(url);
    
    const {username} = parsedUrl.query;

    const user = new User(username, ws);
    if (!username) {
        // console.count('No username was provided... closing socket');
        return noUsernameError(ws);
    }


    try {
        const ip = ws._socket.remoteAddress;
        console.log(`User ${username} comes from ${ip}`);
        ips.set(username, ip);
        console.log('Updated ips table:\n');
        console.dir(ips);
    } catch (e) {
        // w/e

    }

    if (clients.has(username)) {
        // console.count('Username already in use... closing socket');
        return usernameInUseError(ws);
    }

    if (username.toLowerCase() === 'admin') {
        return reservedUsernameError(ws);
    }

    // We add the user to our list
    clients.set(username, ws);

    // Notify the connected user of channels
    updateChannelsList(null, user);

    // Execute the welcome command
    const welcomeCommand = commands.get('!welcome');
    if (welcomeCommand && welcomeCommand.execute) {
        const general = channels.get(defaultChannels[0].id);
        welcomeCommand.execute(user, {
            targettedChannel: {
                ...general,
                channelId: general.id
            },
            defaultChannels,
            channels,
            updateAllChannelsList,
            userPreferences
        });
    }

    defaultChannels.filter(ch => ch.joinStatus).forEach(ch => {
        addClientToChannel(user, ch.id);
    });

    console.log(`Client connected with username ${username}`);
    updateAllChannelsListButClient(user);

    ws.on('close', function (ws, code, reason) {
        console.log(`Client with username ${username} disconnected`);
        clients.delete(username);
        for (let [channelId, channel] of channels) {
            if (channel.clients.has(username)) {
                removeClientFromChannel(user, channelId);
            }
            if (channel.vocalClients.has(username)) {
                removeClientFromVocalChannel(user, channelId);
            }
        }
        updateAllChannelsList();
    });

    ws.on('message', (event) => {
        // console.log(`Received message: ${event}`);
        try {
            const deserializedEvent = JSON.parse(event);
            const {eventType} = deserializedEvent;
            if (eventType && supportedEvents.hasOwnProperty(eventType)) {
                supportedEvents[eventType](deserializedEvent, user);
            }
        } catch (e) {
            console.log(`An unexpected error occured in the message receiving deserialization routine.\n
                        details: ${e}`);
        }
    });

    ws.on('error', (event) => {
        console.log(`Socket error occured with client with username ${user.username}`);
    });
});



const addClientToChannel = (user, channelId) => {
    const {username, client} = user;

    const channel = channels.get(channelId);

    if (channel.clients.has(username)) {
        return;
    }

    channel.clients.set(username, client);

    const data = `${username} a rejoint le groupe`;
    const timestamp = new Date();
    const joinedMessage = JSON.stringify({
        eventType: 'onMessage',
        channelId,
        data,
        sender: 'Admin',
        timestamp
    });
    channel.messages.push(new Message('onMessage', channelId, data, 'Admin', timestamp));
    
    for (let [username, client] of channel.clients) {
        if (userPreferences.has(username)) {
            const {ignoreUserUpdates} = userPreferences.get(username);
            if (ignoreUserUpdates)
                continue;
        } 
        trySendMessage({client}, joinedMessage);
    }
};

const removeClientFromChannel = (user, channelId) => {
    if (!channelId || !channels.has(channelId)) {
        return;
    }
    const channel = channels.get(channelId);
    channel.clients.delete(user.username);

    const data = `${user.username} a quitté le groupe`;
    const timestamp = new Date();

    const leftMessage = JSON.stringify({
        eventType: 'onMessage',
        channelId,
        data,
        sender: 'Admin',
        timestamp
    });
    channel.messages.push(new Message('onMessage', channelId, data, 'Admin', timestamp));

    for (let [username, client] of channel.clients) {
        if (userPreferences.has(username)) {
            const {ignoreUserUpdates} = userPreferences.get(username);
            if (ignoreUserUpdates)
                continue;
        }
        trySendMessage({client}, leftMessage);
    }
};

/**
 *
 * @param {signal, streamId} data
 * @param user
 * @param channelId
 */
const addClientToVocalChannel = (data, user, channelId) => {
    try {

        const {signal, streamId} = data;
        const {username, client} = user;

        const channel = channels.get(channelId);

        if (channel.vocalClients.has(username)) {
            return;
        }



        const peer = new Peer({initiator: false, wrtc});
        peer.signal(signal);

        peer.on('signal', (function(signal) {
            // console.log('received signal', signal);

            const message = JSON.stringify({
                eventType: 'onPeerSignal',
                channelId,
                data: signal,
                sender: 'Admin'
            });
            trySendMessage(user, message);
        }).bind(this));

        peer.on('stream', function(stream) {
            // Set self
            const ownVocalClient = channel.vocalClients.get(username);
            if (ownVocalClient) {
                channel.vocalClients.set(username, {
                    ...ownVocalClient,
                    stream
                });
            }

            for (let [username, {peer}] of channel.vocalClients) {
                if (username === user.username) {
                    console.log('Skipping ourself');
                    continue;
                }
                peer.addStream(stream);
                console.log(`Added ${user.username}'s vocal stream to user "${username}"`);
            }
        });

        peer.on('connect', function() {
            const message = JSON.stringify({
                eventType: 'onJoinedVoiceChannel',
                channelId,
                sender: 'Admin'
            });
            trySendMessage(user, message);

            const {vocalClients} = channels.get(channelId);

            vocalClients.forEach(vC => {
                if (vC.streamId === streamId) {
                    console.log('Skipping self stream');
                    return;
                }
                console.log(`Adding existing stream with id ${vC.streamId} to newly connected user "${username}"`);
                peer.addStream(vC.stream);
            });
        });

        peer.on('error', function(e) {console.error(e);});

        channel.vocalClients.set(username, {
            client,
            peer,
            streamId,
            stream: null
        });
    } catch (e) {
        console.error(e);
    }
};

const removeClientFromVocalChannel = (user, channelId) => {
    if (!channelId || !channels.has(channelId)) {
        return;
    }
    const channel = channels.get(channelId);
    const vocalClient = channel.vocalClients.get(user.username);
    if (!vocalClient) {
        return;
    }

    const {streamId} = vocalClient;

    if (streamId) {
        const streamIndex = vocalClient.peer.streams.findIndex(s => s.id === streamId);

        if (streamIndex !== -1) {
            const stream = vocalClient.peer.streams[streamIndex];
            // Remove stream from peers still referencing it
            for (let [username, otherVocalClient] of channel.vocalClients) {
                const currentPeer = otherVocalClient.peer;
                if (currentPeer) {
                    console.log(`Removed user ${user.username} who left from user ${username}'s streams`);
                    currentPeer.removeStream(stream);
                }
            }
        }


    }

    vocalClient.peer.destroy();
    channel.vocalClients.delete(user.username);
};



const updateAllChannelsListButClient = (user) => {
    for (let [username, client] of clients) {
        if (username === user.username) {
            continue;
        }
        updateChannelsList(null, new User(username, client));
    }
};

const updateAllChannelsList = () => {
    for (let [username, client] of clients) {
        updateChannelsList(null, new User(username, client));
    }
};

module.exports = {
    updateAllChannelsList
};