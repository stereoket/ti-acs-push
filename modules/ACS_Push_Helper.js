var configs = require('modules/Config'), ANDROID = configs.android, CloudPush, Cloud;
Cloud = require('ti.cloud');
if (ANDROID) {
    CloudPush = require('ti.cloudpush');
}
/**
 * Creates a new Push Notification ACS Helper Object
 * @author Ketan Majmudar ket@spiritquest.co.uk
 * @constructor
 */
var ACSpush = function() {"use strict";
    // Assume being called for the first time, check persistent data
    /*
     acsUserID
     acsUSerName
     acsPassword

     subscribeToPush
     loggedInToACS

     defaultACSuserName
     defaultACSuserID
     defaultACSpassword

     */
    this.subscribedChannels = Ti.App.Properties.getList('subscribedChannels');
    if (this.subscribedChannels === null) {
        Ti.API.info('Setting channel List for the first time');
        this.subscribedChannels = [{
            channel : 'general',
            state : false
        }];
        Ti.App.Properties.setList('subscribedChannels', this.subscribedChannels);
    }

};

ACSpush.prototype.getConfigValues = function() {"use strict";
    this.pushTXT = configs.pushNotification();
    return;
};

ACSpush.prototype.login = function() {"use strict";
};

ACSpush.prototype.returnDeviceToken = function() {"use strict";
    Ti.API.warn('Device Token:  ' + this.deviceToken);
    return this.deviceToken;
};

ACSpush.prototype.storeDeviceToken = function() {"use strict";
    if ( typeof this.deviceToken === "string") {
        Ti.API.warn('Setting App property "deviceToken" :  ' + this.deviceToken);
        Ti.App.Properties.setString('deviceToken', this.deviceToken);
        var pw = Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);
        Ti.App.Properties.setString('acsPassword', pw);
    } else {
        Ti.API.error('Bad Device Token');
    }

    return;
};

ACSpush.prototype.deleteDeviceToken = function() {"use strict";
    Ti.API.warn('Removing Device Token value from App Proerpty:  ');
    Ti.App.Properties.removeProperty('deviceToken');
    return;
};

ACSpush.prototype.returnPushPayload = function() {"use strict";
    return this.payload;
};

ACSpush.prototype.getDeviceToken = function(params) {"use strict";
    Ti.API.warn(' ****** getDeviceToken ****** ');
    var successCallback, errorCallback, messageCallback;
    var that = this;
    // Device token registraton Callbacks
    function successCallback(e) {
        Ti.API.warn("*** SUCCESS CALLBACK From DEVICE REGISTRATION ***");
        that.deviceToken = e.deviceToken;
        that.storeDeviceToken();
        if (params.callback !== undefined) {
            // Fire callback from originating script.
            params.callback();
        }
        return;
    };
    function errorCallback(e) {
        Ti.API.error('Could not get the device token');
        Ti.API.error(JSON.stringify(e));
        return;
    };
    function messageCallback(evt) {
        that.payload = evt.data;
        Ti.API.info(that.payload);

        // Get config Values
        that.getConfigValues();
        // Setup maessage alert function
        var showMessageAlert = function(msgParams) {
            var pushAlert = Ti.UI.createAlertDialog({
                title : msgParams.title,
                message : msgParams.message,
                buttonNames : ['OK']
            });
            pushAlert.show();

            Ti.UI.iPhone.appBadge = (Ti.UI.iPhone.appBadge > 0 ) ? Ti.UI.iPhone.appBadge - 1 : 0;
        };

        // iOS processing of payload
        if (!ANDROID) {

            title = (that.payload.title !== undefined) ? that.payload.title : that.pushTXT.alertTitle;

            Titanium.Media.vibrate();
            // // FIXME TITLE not being exposed - CHECK
            showMessageAlert({
                title : title,
                message : that.payload.alert
            });

        } else {
            // Android processing of payload

            that.payload = JSON.parse(evt.payload);
            if (that.payload.android.title !== undefined) {
                var title = that.payload.android.title;
            } else {
                title = that.pushTXT.alertTitle;
            }

            if (that.payload.android.alert.body !== undefined) {
                var message = that.payload.android.alert.body;
            } else {
                if (that.payload.android.alert !== undefined) {
                    message = that.payload.android.alert;
                }
            }

            showMessageAlert({
                title : title,
                message : message
            });

        }
    };
    // Device Registration calls for both platforms
    if (!ANDROID) {
        if (Ti.Platform.model === 'Simulator') {
            Ti.API.warn(' ********* Simulator Detected ******** ');

            params.callback();
            return;
        }
        Ti.API.info("Registering device to apple for Push Device Token");
        Ti.Network.registerForPushNotifications({
            types : [Titanium.Network.NOTIFICATION_TYPE_BADGE, Titanium.Network.NOTIFICATION_TYPE_ALERT, Titanium.Network.NOTIFICATION_TYPE_SOUND],
            success : successCallback,
            error : errorCallback,
            callback : messageCallback
        });

    } else {
        // Android Device Token
        CloudPush.retrieveDeviceToken({
            success : successCallback,
            error : errorCallback
        });
        // Android Event Listener to trigger when payload is received
        CloudPush.addEventListener('callback', messageCallback);
    }

};

/**
 * Checks the device Persistent data store to see if this device has registered with Push Device servers,
 * and if subscribed to the push notification ACS system.
 */
ACSpush.prototype.deviceTokenCheck = function() {
    var deviceToken = Ti.App.Properties.getString('deviceToken'), deviceTokenCheck;
    Ti.API.info('value of deviceToken :' + deviceToken);
    if (deviceToken === null || deviceToken === undefined || !deviceToken) {
        Ti.API.info('Device token not previously stored');
        // Attempt to get new device Token

        deviceTokenCheck = false;
    } else {
        this.deviceToken = deviceToken;
        deviceTokenCheck = true;
    }
    Ti.API.info('value of deviceTokenCheck :' + deviceTokenCheck);
    // when device token retrieved and push subscribed - then set pushSubscription.

    // console.log("Checking Device");
    // Check the device App Property for previous tag
    // get deviceToken value
    // get loggedIntoACS value
    return deviceTokenCheck;
};
/**
 * Will check if a user exists in the ACS userlist. Sets this.createNewUser flag
 * @param {Object} params Object of search parameters for the ACS where query
 * @param {String} params.username The 'username' to be looked up
 */
ACSpush.prototype.queryNewACSuser = function(params) {"use strict";
    var that = this;
    // Looking for user with device token as username
    Ti.API.info('queryNewACSuser: ' + JSON.stringify(params));

    // Checks for device simulator on iOS
    if (Ti.Platform.model === 'Simulator') {
        Ti.API.warn(' ********* Simulator Detected  - setting predefined token ******** ');
        params.username = '943867593475934857934859743'// default virtual TEST device ID
        this.deviceToken = '943867593475934857934859743';
    }

    // requires device token to be present to run this routine.

    if (params.username !== null) {
        var queryUsername = params.username.toLowerCase();
    } else {
        queryUsername = null;
    }

    Cloud.Users.query({
        where : {
            "username" : queryUsername
        }
    }, function(e) {
        Ti.API.info(JSON.stringify(e));
        if (e.success && e.users.length > 0) {
            that.createNewUser = false;
            Ti.API.warn('Success User Already Setup: ');
            that.ACSuserCallback = e.users[0];
            params.callback();
        } else {
            that.createNewUser = true;
            Ti.API.error('No User found with username ' + queryUsername);
            Ti.API.error('Error: ' + ((e.error && e.message) || JSON.stringify(e)));
            params.callback();
        }
    });
};

ACSpush.prototype.showLoggedInACSuser = function(params) {
    var that = this;
    // Network check required first before running this method
    Cloud.Users.showMe(function(e) {
        Ti.API.info('Showing Logged In User' + JSON.stringify(e));
        if (e.success) {
            that.loggedInToACS = true;
            var user = e.users[0];
            Ti.API.warn('ACS USer logged in: ' + that.loggedInToACS + ', id: ' + user.id + ' ' + 'first name: ' + user.first_name + ' ' + 'last name: ' + user.last_name);
            if (params.callback !== undefined) {
                params.callback();
            }

        } else {
            that.loggedInToACS = false;
            Ti.API.error('Error: ' + ((e.error && e.message) || JSON.stringify(e)));
            if (params.callback !== undefined) {
                params.callback();
            }
        }
        return;
    });

};

ACSpush.prototype.logUserOutOfACS = function() {
    var that = this;
    Cloud.Users.logout(function(e) {
        Ti.API.info(e);
        if (e.success) {
            that.loggedInToACS = false;
            Ti.API.warn('Logged User out of ACS');
        }
    });
};

ACSpush.prototype.loginUserToACS = function() {
    Ti.API.warn('LOGIN ** TO ** ACS ** - with ' + this.deviceToken);
    var that = this;
    var pw = Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);

    Cloud.Users.login({
        login : this.deviceToken,
        password : pw
    }, function(e) {
        if (e.success) {
            that.loggedInToACS = true;
            that.createNewUser = false;
            var user = e.users[0];

            Ti.API.warn('Success loggin user in: ' + 'id: ' + user.id + ' ' + 'username: ' + user.username + ' ');
            Ti.App.Properties.setString('acsUserID', user.id);
            // Set userID app property
            that.ACSuserCallback = user;
        } else {
            that.loggedInToACS = false;
            Ti.API.error('Error: ' + ((e.error && e.message) || JSON.stringify(e)));
        }
    });
};

ACSpush.prototype.createUserAccount = function(params) {
    var that = this;
    // only run if device token is present - check here.
    // only run if user does not already exist on system. - check here
    Ti.API.warn('The info used for creating a new account' + JSON.stringify(this));
    var pw = Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);
    Ti.API.info('**createUserAccount -username ' + this.deviceToken)
    Ti.API.info('**createUserAccount -pw ' + pw);
    // DELETE THIS
    Cloud.Users.create({
        username : this.deviceToken,
        password : pw,
        password_confirmation : pw
    }, function(e) {
        if (e.success) {
            that.createNewUser = false;
            var user = e.users[0];
            Ti.API.warn('Success in creating user account: ' + 'id: ' + user.id + ' ' + 'username: ' + user.username + ' ');
            Ti.App.Properties.setString('acsUserID', user.id);
            // Set userID app property
            that.ACSuserCallback = user;
            params.callback();
        } else {
            Ti.API.error('Error: ' + ((e.error && e.message) || JSON.stringify(e)));
        }
    });
};

ACSpush.prototype.returnNewUserDetails = function() {

    return this.ACSuserCallback;
};

ACSpush.prototype.returnSubscribedChannels = function() {
    Ti.API.info('Return list of subscribed channels from persistent memory');
    var list = Ti.App.Properties.getList('subscribedChannels');
    return list;
};
/**
 * Subscribe current device to a specific channel
 * @param {Object} params Subscirption properties
 * @param {String} params.channel - Channel to subscribe user to
 * @param {String} params.deviceToken - Device Token passed in
 */
ACSpush.prototype.subscribeToPush = function(params) {
    var that = this, pnt = false;
    Ti.API.info(JSON.stringify(params) + ' passed into method');
    if (params.channel === undefined) {
        params.channel = 'general';
    }
    // Android Devices need to enable with alternative module, this needs its own method
    if (ANDROID) {
        CloudPush.enabled = true;
        CloudPush.setShowTrayNotification = true;
    }

    Cloud.PushNotifications.subscribe({
        channel : params.channel,
        device_token : this.deviceToken,
        type : (ANDROID) ? 'android' : 'ios'
    }, function(f) {
        if (f.success) {
            Ti.API.log('Subscribed to ACS Push Notification: ' + JSON.stringify(f));
            that.subscribeToPushResponse = f;
            that.subscribedChannels = that.returnSubscribedChannels();
            var l = that.subscribedChannels.length, i;
            for ( i = 0; i < l; i += 1) {
                Ti.API.warn('Loop: ' + i + ' of ' + l);
                if (that.subscribedChannels[i].channel === params.channel) {
                    Ti.API.warn('** SUBSCRIBE Looping channel list property  ');
                    pnt = true;
                    that.subscribedChannels[i].state = true;
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
                if (i === l - 1 && !pnt) {
                    Ti.API.warn('** SUBSCRIBE Could not find key, asuming new channel being added:' + params.channel);
                    that.subscribedChannels.push({
                        channel : params.channel,
                        state : true
                    });

                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                    Ti.API.info(that.subscribedChannels);
                }
            }

        } else {
            Ti.API.debug('Error:\n' + ((f.error && f.message) || JSON.stringify(f)))
        }
    });
    return;
};

/**
 * Unsubscribe current device from a specific channel
 * @param {Object} params Subscirption properties
 * @param {String} params.channel - Channel to subscribe user to
 * @param {String} params.deviceToken - Device Token passed in
 */
ACSpush.prototype.unsubscribePushChannel = function(params) {"use strict";
    var that = this, pnt = false;
    Ti.API.info(JSON.stringify(params) + ' passed into method');
    if (params.channel === undefined) {
        params.channel = 'general';
    }

    Cloud.PushNotifications.unsubscribe({
        channel : params.channel,
        device_token : this.deviceToken,
        type : (ANDROID) ? 'android' : 'ios'
    }, function(f) {
        if (f.success) {
            Ti.API.log('Unsubscribed Push Notification from Channel: ' + JSON.stringify(f));
            that.unsubscribeToPushResponse = f;
            that.subscribedChannels = that.returnSubscribedChannels();
            var l = that.subscribedChannels.length, i;
            for ( i = 0; i < l; i += 1) {
                Ti.API.warn('Loop: ' + i + ' of ' + l);
                if (that.subscribedChannels[i].channel === params.channel) {
                    Ti.API.warn('** UNSUBSCRIBE CHANNEL - Looping channel list property');
                    pnt = true;
                    that.subscribedChannels[i].state = false;
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
                if (i === l - 1 && !pnt) {
                    Ti.API.warn('** UNSUBSCRIBE CHANNEL - Could not find key, asuming new channel being added:' + params.channel);
                    that.subscribedChannels.push({
                        channel : params.channel,
                        state : false
                    });
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
            }

        } else {
            Ti.API.debug('Error:\n' + ((f.error && f.message) || JSON.stringify(f)))
        }
    });
    return;
};
/**
 * Send push notifications out through the ACS system, payload and limitations
 * @param {Object} params paramateres for payload and push properties
 * @param {String} params.channel - channel to send out to
 * @param {String} params.payload - the payload data to send through the
 * @param {String} params.to_ids - Comma separated user ids of who to send push notification to , if subscribed to the specified channel.
 */
ACSpush.prototype.sendPushNotification = function(params) {
    // this.checkIfLoggedIn();
    var that = this;
    // Check if the payload is correctly setup
    Cloud.PushNotifications.notify({
        channel : params.channel || "general", // choose the general channel if no specific channel setup
        to_ids : params.to_ids,
        payload : params.payload
    }, function(e) {
        if (e.success) {
            Ti.API.warn('Success in posting push notice');
        } else {
            Ti.API.error('Callback Error:\\n' + ((e.error && e.message) || JSON.stringify(e)));
        }
        that.notifyResponse = e;
    });

};

ACSpush.prototype.loginUser = function() {
    var that = this;
    Ti.API.warn(' ********* loginUser - callback ******** ');
    Ti.API.warn(' ********* Login user to ACS - ' + that.createNewUser + ' ******** ');
    that.loginUserToACS();
};

ACSpush.prototype.queryCallback = function() {
    Ti.API.warn(' ********* queryCallback - callback ******** ');
    if (this.createNewUser) {
        Ti.API.warn(' ********* Need to create a new ACS user account: ' + this.createNewUser + ' ******** ');
        this.createUserAccount({
            callback : this.loginUser
        });
    } else {
        this.loginUser();
    }
};

ACSpush.prototype.loginCallback = function() {
    Ti.API.warn(' ********* loginCallback - callback ******** ');
    this.deviceToken = Ti.App.Properties.getString('deviceToken');
    /**
     * Checks to see if the logged in state is true, after a small delay for network check,
     * this ideally needs to be asynchronous, but the code will need refactoring for that
     */

    if (!this.loggedInToACS) {
        Ti.API.warn(' ********* This device is NOT Logged into ACS ******** ');
        Ti.API.warn(' ********* About to Query ACS userbase against this device ******** ');

        this.queryNewACSuser({
            username : this.deviceToken,
            callback : this.queryCallback
        });

    } else {
        Ti.API.warn(' ********* User Logged IN true - no need to create new account ******** ');
    }
};

ACSpush.prototype.deviceCallback = function() {
    var that=this;
    Ti.API.warn(' ********* getDeviceToken - callback ******** ');
    /**
     * Performs checks to see if the device has a token and if not creates one, storing the value
     * into persistent storage.
     */
    that.getDeviceToken({
        callback : that.loginCallback
    });
};

ACSpush.prototype.checkNetwork = function() {"use strict";
    var check, Helper, net;
    check = require('modules/Helper');
    Helper = new check.Helper();
    net = Helper.checkConnectivity();
    // actions based on network state:

    if (net) {
        // Network connection is active, perform
    } else {
        // No network connection, perform failed.
        Ti.API.warn("No Network connection detected. Required");
        // potentially defer login - implications of not being able to login
        // set ACS login flag to false
    }
    return net;

};
exports.ACSpush = ACSpush;
