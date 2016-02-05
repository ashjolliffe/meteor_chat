profiles = new Mongo.Collection("profiles");
contacts = new Mongo.Collection("contacts");
messages = new Mongo.Collection("messages");

if (Meteor.isServer) {
  Meteor.publish("contacts", function () {
    return contacts.find({
        $or:[
          {to_user : this.userId}, 
          { from_user : this.userId}
        ]
    });
  });

  Meteor.publish("profiles", function () {
    return profiles.find({});
  });

  Meteor.publish("messages", function(){
    return messages.find({
        $or:[
          {to_user : this.userId}, 
          {from_user : this.userId}
        ]
    });
  });

  Meteor.methods({
    addContact: function (from_user,to_user) {
      // Make sure the user is logged in before inserting a task
      if (! Meteor.userId()) {
        throw new Meteor.Error("not-authorized");
      }

      var x = Meteor.users.findOne({username: to_user},{fields:{'_id':1}});
      var from_name = Meteor.users.findOne(from_user);
      contacts.insert({
        to_user: x._id,
        to_user_acc: false,
        to_user_name: to_user,
        from_user: from_user,
        from_user_acc: true,
        from_user_name: from_name.username,
      });

  },

  sendMessage: function (toUser, fromUser,text) {
      // Make sure the user is logged in before inserting a task
      if (! Meteor.userId()) {
        throw new Meteor.Error("not-authorized");
      }

      messages.insert({
        to_user: toUser,
        from_user: fromUser,
        text: text,
        date: new Date()
      });

  },


    acceptRequest: function (requestID) {
    var contact = contacts.findOne(requestID);
    console.log(requestID);
    if (contact.to_user !== Meteor.userId()) {
      // If the task is private, make sure only the owner can delete it
      throw new Meteor.Error("not-authorized");
    }

    contacts.update(requestID, {$set: {to_user_acc: true}});
  },

    deleteRequest: function (requestID) {
    var contact = contacts.findOne(requestID);
    console.log(requestID);
    if (contact.to_user !== Meteor.userId() && contact.from_user !== Meteor.userId()) {
      // If the task is private, make sure only the owner can delete it
      throw new Meteor.Error("not-authorized");
    }

    contacts.remove(requestID);
  }

  });
}

if (Meteor.isClient) {

    // request permission on page load
  document.addEventListener('DOMContentLoaded', function () {
    if (Notification.permission !== "granted")
      Notification.requestPermission();
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

  Router.route('/', function () {
  this.render('Home');
  });

  Router.route('/add_contact', function () {
  this.render('new_contact');
  });

  Router.route('/conversation/:conversation_id', function(){

  Meteor.subscribe("messages");
  Session.set("conversationId",this.params.conversation_id);
  this.render('conversation',{data: {convoId: this.params.conversation_id}});

  });

  Meteor.subscribe("profiles");
  Meteor.subscribe("contacts");

  Template.home.helpers({
    contacts: function(){
      return contacts.find({});
    }
  });

  Template.message.helpers({
    isMine: function (fromUser) {
      return fromUser === Meteor.userId();
    }
  });

  Template.contact.helpers({
    toThisUser: function (toId) {
      return toId === Meteor.userId()
    }

  });

  Template.message.helpers({
    toThisUser: function (toId) {
      return toId === Meteor.userId()
    }
  });

  Template.conversation.helpers({

    messages:function(){
    
    var convoObject = contacts.findOne(Session.get("conversationId"));

    var theirId;

    if(convoObject.to_user === Meteor.userId()){
      theirId = convoObject.from_user;
    } else {
      theirId = convoObject.to_user;
    }

    console.log(theirId);
    Session.set("theirId", theirId);

      return messages.find({
        $or:[
          {from_user: Meteor.userId(), to_user: theirId}, 
          {to_user : Meteor.userId(), from_user: theirId}
        ]
      }, {sort: {date: 1}});
    }
  });

  Template.contact.events({
    "click .accept": function () {
      Meteor.call("acceptRequest", this._id);
    },

    "click .delete": function () {
      Meteor.call("deleteRequest", this._id);
    },

    "click .chat": function () {
      Router.go('/conversation/'+this._id);
    },
  });

  Template.home.events({
    "click .add_contact_button": function (){
      Router.go('/add_contact/');
    }
  });

  Template.new_contact.events({
    "submit .add_contact": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
      // Get value from form element
      var to_username = event.target.username.value;
      // Insert a task into the collection
      Meteor.call("addContact", Meteor.userId(),to_username);
      //Go back home
      Router.go('/');

    }
  });

  Template.conversation.events({
    "submit .new_message": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
      // Get value from form element
      var to_user = Session.get("theirId");
      var from_user = Meteor.userId();
      var text = event.target.text.value;
      // Insert a task into the collection
      Meteor.call("sendMessage", to_user, from_user,text);
      event.target.text.value = "";
      //Go back home
    }
  });
}
