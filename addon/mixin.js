import Ember from 'ember';
import Errors from 'ember-validations/errors';
import Base from 'ember-validations/validators/base';

var get = Ember.get;
var set = Ember.set;

var setValidityMixin = Ember.Mixin.create({
  isValid: Ember.computed('validators.@each.isValid', function() {
    var compactValidators = get(this, 'validators').compact();
    var filteredValidators = Ember.EnumerableUtils.filter(compactValidators, function(validator) {
      return !get(validator, 'isValid');
    });

    return get(filteredValidators, 'length') === 0;
  }),
  isInvalid: Ember.computed.not('isValid')
});

var pushValidatableObject = function(model, property) {
  var content = get(model, property);

  model.removeObserver(property, pushValidatableObject);
  if (Ember.isArray(content)) {
    model.validators.pushObject(ArrayValidatorProxy.create({model: model, property: property, contentBinding: 'model.' + property}));
  } else {
    model.validators.pushObject(content);
  }
};

var lookupValidator = function(validatorName) {
  var container = get(this, 'container');
  var service = container.lookup('service:validations');
  var cache = get(service, 'cache');
  var validators = [];

  if (cache[validatorName]) {
    validators = validators.concat(cache[validatorName]);
  } else {
    var local = container.lookupFactory('validator:local/'+validatorName);
    var remote = container.lookupFactory('validator:remote/'+validatorName);

    if (local || remote) { validators = validators.concat([local, remote]); }
    else {
      var base = container.lookupFactory('validator:'+validatorName);

      if (base) { validators = validators.concat([base]); }
      else {
        local = container.lookupFactory('ember-validations@validator:local/'+validatorName);
        remote = container.lookupFactory('ember-validations@validator:remote/'+validatorName);

        if (local || remote) { validators = validators.concat([local, remote]); }
      }
    }

    cache[validatorName] = validators;
  }

  if (Ember.isEmpty(validators)) {
    Ember.warn('Could not find the "'+validatorName+'" validator.');
  }

  return validators;
};

var ArrayValidatorProxy = Ember.ArrayProxy.extend(setValidityMixin, {
  validate: function() {
    return this._validate();
  },
  _validate: Ember.on('init', function() {
    var promises = get(this, 'content').invoke('_validate').without(undefined);
    return Ember.RSVP.all(promises);
  }),
  validators: Ember.computed.alias('content')
});

export default Ember.Mixin.create(setValidityMixin, {
  init: function() {
    this._super();
    this.errors = Errors.create();
    this.dependentValidationKeys = {};
    this.validators = Ember.A();
    if (get(this, 'validations') === undefined) {
      this.validations = {};
    }
    this.buildValidators();
    this.validators.forEach(function(validator) {
      validator.addObserver('errors.[]', this, function(sender) {
        var errors = Ember.A();
        this.validators.forEach(function(validator) {
          if (validator.property === sender.property) {
            errors.addObjects(validator.errors);
          }
        }, this);
        set(this, 'errors.' + sender.property, errors);
      });
    }, this);
  },
  buildValidators: function() {
    var property;

    for (property in this.validations) {
      if (this.validations[property].constructor === Object) {
        this.buildRuleValidator(property);
      } else {
        this.buildObjectValidator(property);
      }
    }
  },
  buildRuleValidator: function(property) {
    var pushValidator = function(validator) {

      /**/
      var parentController = this.get('parentController');
      while(parentController) {
        if(parentController.get('parentController')) {
          parentController = parentController.get('parentController');
        }
        break;
      }

      if (validator) {
        var pushObj = validator.create({model: this, property: property, options: this.validations[property][validatorName]});
        this.validators.pushObject(pushObj);
        if(parentController) {
          // pushObj.set('pc', parentController);
          parentController.get('validators').pushObject(pushObj);
          // @TODO: figure out why this is flattening a promise array
          var aliasedKey = Ember.String.camelize(this.toString().split(':')[1] + '_' + property);
          // var newValidator = validator.create({model: parentController, property: aliasedKey, options: this.validations[property][validatorName]});
          // parentController.validators.pushObject(newValidator);
          // Ember.Binding.from('parentController.'+aliasedKey).to(property).connect(this);
          //
          // console.log('%%%%', this.toString(), this.get('model').toString());
          console.log('pc model', this.get('model').toString());
          this.get('model').addObserver('isDeleted', this, function(){
            console.log('isDeleted');
            this.validators.forEach(function(validator){
              parentController.get('validators').removeObject(validator);
            });
          });

          // pushObj.addObserver('errors.[]', parentController, function(sender){
          //   // console.log('#####',sender.toString());
          //   // console.log('$$$$$',pushObj.get('errors'));
          //   parentController.set('errors.'+aliasedKey, pushObj.errors);

          //   // if(pushObj.get('errors.length')) {
          //   //   console.log('we have errors, pushing!');
          //   // } else {
          //   //   console.log('we have no errors, do something?');
          //   // }
          //   // console.log(parentController.get('errors'));
          //   // console.log('po.errors',pushObj.errors);
          //   // pushObj.errors.forEach(function(error){
          //   //   console.log('errors', error);
          //   // });
          //   // console.log('++++++',pushObj.get('errors.[]'));
          //   // var derp = parentController.get('errors.'+aliasedKey) //, pushObj.errors);
          //   // parentController.get('errors.'+aliasedKey).pushObject(pushObj.errors);
          //   // console.log('------derp', derp);
          // });

          // so we have a numericality validator and a presence validator.
          // each validator is updating then setting errors to its own thingy. we need to cache these and push somehow.
          // parentController.addObserver('validators.@each', this, function(item){
          //   console.log('validatorsObserver', this.toString());
          // });

          // pushObj.addObserver('isDestroying', function(){
          //   console.log('validator isDestroying');
          // });

          // console.log('$$$$$$$$$$$',parentController.toString(),this.toString());
          parentController.validators.forEach(function(validator) {
            if(!validator.hasObserverFor('errors.[]')) {
              console.log(validator.toString());
              validator.addObserver('errors.[]', this, function(sender) {
                var errors = Ember.A();
                this.validators.forEach(function(validator) {
                  if (validator.property === sender.property) {
                    errors.addObjects(validator.errors);
                  }
                }, this);
                set(this, 'errors.' + sender.property, errors);
              });
            }
          }, parentController);

          // @TODO: fix this lazy way of triggering the validations
          // parentController.validate();
        }
      }
      /**/

    };

    if (this.validations[property].callback) {
      this.validations[property] = { inline: this.validations[property] };
    }

    var createInlineClass = function(callback) {
      return Base.extend({
        call: function() {
          var errorMessage = this.callback.call(this);

          if (errorMessage) {
            this.errors.pushObject(errorMessage);
          }
        },
        callback: callback
      });
    };

    for (var validatorName in this.validations[property]) {
      if (validatorName === 'inline') {
        pushValidator.call(this, createInlineClass(this.validations[property][validatorName].callback));
      } else if (this.validations[property].hasOwnProperty(validatorName)) {
        Ember.EnumerableUtils.forEach(lookupValidator.call(this, validatorName), pushValidator, this);
      }
    }
  },
  buildObjectValidator: function(property) {
    if (Ember.isNone(get(this, property))) {
      this.addObserver(property, this, pushValidatableObject);
    } else {
      pushValidatableObject(this, property);
    }
  },
  validate: function() {
    var self = this;
    return this._validate().then(function(vals) {
      var errors = get(self, 'errors');
      if (Ember.EnumerableUtils.indexOf(vals, false) > -1) {
        return Ember.RSVP.reject(errors);
      }
      return errors;
    });
  },
  _validate: Ember.on('init', function() {
    var promises = this.validators.invoke('_validate').without(undefined);
    return Ember.RSVP.all(promises);
  })
});
