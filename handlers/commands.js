const {trySendMessage, tryClose} = require('./utils');

class Command {
    constructor(helpText) {
        this.helpText = helpText;
    }

    // execute() {}
}

class WelcomeCommand extends Command {
    constructor() {
        super(`Show the welcome message.`);
    }

    execute(user, params) {
        const {channelId} = params.targettedChannel;
        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId,
                data: `Welcome to my server! To show a list of commands, simply send a message with "!help" (for text-only) or "!help-html" (for formatted help).`,
                sender: 'Admin',
                timestamp
            });
        return trySendMessage(user, message);
    }
}

class HelpTextCommand extends Command {
    constructor() {
        super(`Displays a text-only help message`);
    }

    execute(user, params) {
        const {targettedChannel} = params;
        let helpMessage = `Here's a list of all the available commands:\n`;
        for (let [key, command] of commands) {
            helpMessage += `${key} - ${command.helpText}\n`;
        }

        const {channelId} = targettedChannel;
        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId,
                data: helpMessage,
                sender: 'Admin',
                timestamp
            });
        return trySendMessage(user, message);
    }
}


class HelpHtmlCommand extends Command {
    constructor() {
        super(`Displays an html-formatted help message`);
    }

    execute(user, params) {
        const {targettedChannel} = params;
        let listItems = '';
        for (let [key, command] of commands) {
            listItems += `<li>${key} - ${command.helpText}</li>\n`;
        }

        let helpMessage = `<p>Here's a list of all the available commands:<br>
                                <ul>
                                    ${listItems}
                                </ul>
                            </p>`;

        const {channelId} = targettedChannel;
        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId,
                data: helpMessage,
                sender: 'Admin',
                timestamp
            });
        return trySendMessage(user, message);
    }
}


class UsersCommand extends Command {
    constructor() {
        super('Shows the number of users connected to a channel');
    }

    execute(user, params) {
        const {targettedChannel} = params;
        const { channelId } = targettedChannel;

        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId,
                data: `The channel ${targettedChannel.name} has ${targettedChannel.clients.size} user${targettedChannel.clients.size > 1 ? 's' : ''} connected to it.`,
                sender: 'Admin',
                timestamp
            });
        return trySendMessage(user, message);
    }
}

class ListUsersCommand extends Command {
    constructor() {
        super('Shows the complete list of users for a specific channel');
    }

    execute(user, params) {
        const {targettedChannel} = params;
        const { channelId } = targettedChannel;
        let users = '';

        for (let username of targettedChannel.clients.keys()) {
            users +=` ${username},`;
        }

        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId,
                data: `The channel ${targettedChannel.name} has the following ${targettedChannel.clients.size} users connected to it:${users.slice(0, -1)}`,
                sender: 'Admin',
                timestamp
            });
        return trySendMessage(user, message);
    }
}


class ClearChannelsCommand extends Command {
    constructor() {
        super('Clears the list of channels if there are less than 2 users in them.');
    }

    execute(user, params) {
        const {targettedChannel, defaultChannels, channels, updateAllChannelsList} = params;

        for (let [channelId, channel] of channels) {
            if (defaultChannels.findIndex(c => c.id === channelId) !== -1)
                continue;
            if (channel.clients.size <= 1) {
                channels.delete(channelId);
            }
        }

        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId: targettedChannel.channelId,
                data: `Clean command has been executed.`,
                sender: 'Admin',
                timestamp
            });
        trySendMessage(user, message);

        return updateAllChannelsList();
    }
}

class MuteChannelUpdatesCommand extends Command{
    constructor() {
        super("Mutes the join/leave messages for a user.");
    }

    /**
     * 
     * @param {User} user 
     * @param {*} params 
     */
    execute(user, params) {
        const { targettedChannel, userPreferences } = params;
        const { username } = user;

        userPreferences.set(username, {
            ...userPreferences.get(username),
            ignoreUserUpdates: true,
        });

        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId: targettedChannel.channelId,
                data: `Join/leave messages are now muted. Use !unmute-channel-updates to unmute.`,
                sender: 'Admin',
                timestamp
            });
        trySendMessage(user, message);
    }
}

class UnmuteChannelUpdatesCommand extends Command{
    constructor() {
        super("Unmutes the join/leave messages for a user.");
    }

    /**
     * 
     * @param {User} user 
     * @param {*} params 
     */
    execute(user, params) {
        const { targettedChannel, userPreferences } = params;
        const { username } = user;

        userPreferences.set(username, {
            ...userPreferences.get(username),
            ignoreUserUpdates: false,
        });

        const timestamp = new Date();
        const message = JSON.stringify(
            {
                eventType: 'onMessage',
                channelId: targettedChannel.channelId,
                data: `Join/leave messages are now unmuted. Use !mute-channel-updates to mute.`,
                sender: 'Admin',
                timestamp
            });
        trySendMessage(user, message);
    }
}


const commands = new Map([
    ['!welcome', new WelcomeCommand()],
    ['!help', new HelpTextCommand()],
    ['!help-html', new HelpHtmlCommand()],
    ['!users', new UsersCommand()],
    ['!who', new ListUsersCommand()],
    ['!clean', new ClearChannelsCommand()],
    ['!mute-channel-updates', new MuteChannelUpdatesCommand()],
    ['!unmute-channel-updates', new UnmuteChannelUpdatesCommand()]
]);

module.exports = {
    commands: commands
};

