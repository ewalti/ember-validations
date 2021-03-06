import Ember from 'ember';
import Base from 'ember-validations/validators/base';
import Messages from 'ember-validations/messages';
import Patterns from 'ember-validations/patterns';

var get = Ember.get;

export default Base.extend({
  init: function() {
    /*jshint expr:true*/
    var index, keys, key;
    this._super();

    if (this.options === true) {
      this.options = {};
    } else if (this.options.constructor === String) {
      key = this.options;
      this.options = {};
      this.options[key] = true;
    }

    if (this.options.messages === undefined || this.options.messages.numericality === undefined) {
      this.options.messages = this.options.messages || {};
      this.options.messages.numericality = Messages.render('notANumber', this.options);
    }

    if (this.options.onlyInteger !== undefined && this.options.messages.onlyInteger === undefined) {
      this.options.messages.onlyInteger = Messages.render('notAnInteger', this.options);
    }

    keys = Ember.keys(this.CHECKS).concat(['odd', 'even']);
    for(index = 0; index < keys.length; index++) {
      key = keys[index];

      var prop = this.options[key];
      // I have no idea what the hell is going on here. This seems to do nothing.
      // The observer's key is being set to the values in the options hash?
      if (key in this.options && isNaN(prop)) {
        this.model.addObserver(prop, this, this._validate);
      }

      if (prop !== undefined && this.options.messages[key] === undefined) {
        if (Ember.$.inArray(key, Ember.keys(this.CHECKS)) !== -1) {
          this.options.count = prop;
        }
        this.options.messages[key] = Messages.render(key, this.options);
        if (this.options.count !== undefined) {
          delete this.options.count;
        }
      }
    }
  },
  CHECKS: {
    equalTo              :'===',
    greaterThan          : '>',
    greaterThanOrEqualTo : '>=',
    lessThan             : '<',
    lessThanOrEqualTo    : '<='
  },
  call: function() {
    var check, checkValue, fn, operator;

    if (Ember.isEmpty(get(this.model, this.property))) {
      if (this.options.allowBlank === undefined) {
        this.errors.pushObject({subject: this.options.subject, message: this.options.message});
        // this.errors.pushObject(this.options.messages.numericality);
      }
    } else if (!Patterns.numericality.test(get(this.model, this.property))) {
      // this.errors.pushObject(this.options.messages.numericality);
      this.errors.pushObject({subject: this.options.subject, message: this.options.message});
    } else if (this.options.onlyInteger === true && !(/^[+\-]?\d+$/.test(get(this.model, this.property)))) {
      this.errors.pushObject(this.options.messages.onlyInteger);
    } else if (this.options.odd  && parseInt(get(this.model, this.property), 10) % 2 === 0) {
      this.errors.pushObject(this.options.messages.odd);
    } else if (this.options.even && parseInt(get(this.model, this.property), 10) % 2 !== 0) {
      this.errors.pushObject(this.options.messages.even);
    } else {
      for (check in this.CHECKS) {
        operator = this.CHECKS[check];

        if (this.options[check] === undefined) {
          continue;
        }

        if (!isNaN(parseFloat(this.options[check])) && isFinite(this.options[check])) {
          checkValue = this.options[check];
        } else if (get(this.model, this.options[check]) !== undefined) {
          checkValue = get(this.model, this.options[check]);
        }

        fn = new Function('return ' + get(this.model, this.property) + ' ' + operator + ' ' + checkValue);

        if (!fn()) {
          this.errors.pushObject(this.options.messages[check]);
        }
      }
    }
  }
});
