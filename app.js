// Ti.API.info('Starting ACS start up process - getting device token')
// if (Ti.App.Properties.getBool('acs-init')) {
// Ti.API.warn('********* ACS login already initialised ******** ');
// break;
// }

Ti.App.Properties.setBool('acs-init', true);
var acs_ph = require('/modules/ACS_Push_Helper');
var ACS = new acs_ph.ACSpush();

function loginUser() {
    Ti.API.warn(' ********* loginUser - callback ******** ');
    Ti.API.warn(' ********* Login user to ACS - ' + ACS.createNewUser + ' ******** ');
    ACS.loginUserToACS();
};

// probably needs renaming

function queryCallback() {
    Ti.API.warn(' ********* queryCallback - callback ******** ');
    if (ACS.createNewUser) {
        Ti.API.warn(' ********* Need to create a new ACS user account: ' + ACS.createNewUser + ' ******** ');
        ACS.createUserAccount({
            callback : loginUser
        });
    } else {
        loginUser();
    }
};

function loginCallback() {
    Ti.API.warn(' ********* loginCallback - callback ******** ');
    ACS.deviceToken = Ti.App.Properties.getString('deviceToken');
    /**
     * Checks to see if the logged in state is true, after a small delay for network check,
     * this ideally needs to be asynchronous, but the code will need refactoring for that
     */

    if (!ACS.loggedInToACS) {
        Ti.API.warn(' ********* This device is NOT Logged into ACS ******** ');
        Ti.API.warn(' ********* About to Query ACS userbase against this device ******** ');

        ACS.queryNewACSuser({
            username : ACS.deviceToken,
            callback : queryCallback
        });

    } else {
        Ti.API.warn(' ********* User Logged IN true - no need to create new account ******** ');
    }
};

function getDeviceToken() {
    Ti.API.warn(' ********* getDeviceToken - callback ******** ');
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
    callback : getDeviceToken
});
