import Map "mo:core/Map";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Order "mo:core/Order";

import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";


actor {
  type Variant = {
    questionText : Text;
    optionA : Text;
    optionB : Text;
    optionC : Text;
    correctOption : Text; // "A", "B", or "C"
  };

  type GenerationSettings = {
    integerOnly : Bool;
    decimalPrecision : Nat;
    fractionMode : Bool;
    quantity : Nat;
  };

  type SessionId = Text;

  type Session = {
    id : SessionId;
    user : Principal;
    timestamp : Int;
    originalQuestion : Text;
    settings : GenerationSettings;
    variants : [Variant];
  };

  public type UserProfile = {
    name : Text;
  };

  module Session {
    public func compare(session1 : Session, session2 : Session) : Order.Order {
      Text.compare(session1.id, session2.id);
    };
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let sessions = Map.empty<SessionId, Session>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Session Management
  public shared ({ caller }) func saveSession(id : SessionId, originalQuestion : Text, settings : GenerationSettings, variants : [Variant]) : async SessionId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save sessions");
    };
    let timestamp = Time.now();
    let session : Session = {
      id;
      user = caller;
      timestamp;
      originalQuestion;
      settings;
      variants;
    };
    sessions.add(id, session);
    id;
  };

  public query ({ caller }) func getSession(id : SessionId) : async Session {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access sessions");
    };
    switch (sessions.get(id)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) {
        if (not Principal.equal(session.user, caller) and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only access your own sessions");
        };
        session;
      };
    };
  };

  public query ({ caller }) func getAllSessions() : async [Session] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access sessions");
    };
    sessions.values().toArray().filter(func(session) { Principal.equal(session.user, caller) }).sort();
  };

  public shared ({ caller }) func deleteSession(id : SessionId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete sessions");
    };
    switch (sessions.get(id)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) {
        if (not Principal.equal(session.user, caller) and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only delete your own sessions");
        };
        sessions.remove(id);
      };
    };
  };

  public query ({ caller }) func countSessions() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can count sessions");
    };
    sessions.entries().filter(func((id, session)) { Principal.equal(session.user, caller) }).size();
  };
};
