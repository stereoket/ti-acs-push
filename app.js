// Ti.API.info('Starting ACS start up process - getting device token')
// if (Ti.App.Properties.getBool('acs-init')) {
// Ti.API.warn('********* ACS login already initialised ******** ');
// break;
// }

Ti.App.Properties.setBool('acs-init', true);
var acs_ph = require('/modules/ACS_Push_Helper');
var ACS = new acs_ph.ACSpush();

var loginUser = function() {
    Ti.API.warn(' ********* Login Callback ******** ');
    Ti.API.warn(' ********* Login user to ACS - ' + ACS.createNewUser + ' ******** ');
    ACS.loginUserToACS();
};

// probably needs renaming

var queryCallback = function() {
    Ti.API.warn(' ********* Query Callback ******** ');
    if (ACS.createNewUser) {
        Ti.API.warn(' ********* Need to create a new ACS user account: ' + ACS.createNewUser + ' ******** ');
        ACS.createUserAccount({
            callback : loginUser
        });
    } else {
        loginUser();
    }
};

var loginCallback = function(inparam) {
    Ti.API.warn(' ********* Login Callback ******** ');
    ACS.deviceToken = Ti.App.Properties.getString('deviceToken');
    /**
     * Checks to see if the logged in state is true, after a small delay for network check,
     * this ideally needs to be asynchronous, but the code will need refactoring for that
     */

    if (!ACS.loggedInToACS) {
        Ti.API.warn(' ********* This device is NOT Logged into ACS ******** ');
        Ti.API.warn(' ********* About to Query ACS userbase against this device ******** ');

        Ti.API.warn(' ********* Setting up callbacks ******** ');

        ACS.queryNewACSuser({
            username : ACS.deviceToken,
            callback : queryCallback
        });

    } else {
        Ti.API.warn(' ********* User Logged IN true - no need to create new account ******** ');
    }
};

var deviceCallback = function() {
    Ti.API.warn(' ********* Device Callback ******** ');
    /**
     * Performs checks to see if the device has a token and if not creates one, storing the value
     * into persistent storage.
     */

    ACS.getDeviceToken({
        callback : loginCallback
    });

};

/**
 * First checking to see if the user is logged into Appcelerator Cloud Services.
 */
ACS.showLoggedInACSuser({
    callback : deviceCallback
});