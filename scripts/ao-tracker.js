const ao_gtm = {
            init() {
                window.dataLayer = window.dataLayer || [];
            },

            track(form_name, params, callback) {
                const self = this;

                // Estimate Request
                if (form_name === 'estimate') {
                    window.dataLayer.push({
                        'event': 'ao_estimate_lead',
                        'params': self.kvArrayToObj(params)
                    });
                    callback();
                    return;
                }

                // Contact Request
                else if (form_name === 'contact') {
                    window.dataLayer.push({
                        'event': 'ao_contact_lead',
                        'params': self.kvArrayToObj(params)
                    });
                    callback();
                    return;
                }

                // Default
                window.dataLayer.push({
                    'event': 'ao_career_applicant',
                    'params': self.kvArrayToObj(params)
                });
                callback();
            },

            kvArrayToObj(array) {
                var obj = {};

                for (var i = 0; i < array.length; i++) {

                    var _obj = array[i];

                    obj[_obj.name] = _obj.value;

                }

                return obj;
            }
        }

        const ao = {
            redirect_urls: {
                careers: '/careers-thank-you',
                contact: '/contact-thank-you',
                estimate: '/estimate-thank-you'
            },
            cookie_name: 'ao-uuid',
            debugger: false,
            base_url: 'https://activeoffice.app',

            init: function() {
                var self = this;

                // Check whether to turn on the debugger
                if (document.querySelector('script[test-mode]')) {
                    this.debugger = true;
                    this.base_url = "https://active-office.test";
                    this.debug("Debugger was turned on");
                }

                let uuid = window.localStorage.getItem(self.cookie_name);

                this.debug("Local UUID Value: " + uuid);

                this.trackVisit(uuid, function(data) {

                    self.captureDuration(data.request_id);

                    self.debug("Self: " + self.trackerRequestId);
                    self.debug("Request ID From Server: " + data.request_id);

                    if (data.uuid) {
                        self.debug("Store new UUID: " + data.uuid);
                        window.localStorage.setItem(self.cookie_name, data.uuid);
                    }

                    self.trackForms();

                });

            },

            captureDuration(request_id) {
                let self = this;
                let url = self.base_url + "/tracker/ping/" + request_id;

                document.addEventListener('visibilitychange', function logData() {
                    if (document.visibilityState === 'hidden') {
                        navigator.sendBeacon(url);
                    }
                });

                setInterval(function() {
                    navigator.sendBeacon(url);
                }, 5000);
            },

            trackVisit: function(uuid, callback) {
                this.debug("Tracking visit UUID: " + uuid);

                let self = this;
                let pixel_base_url = this.base_url;

                let pixelURL = pixel_base_url + '/tracker?current_url=' + encodeURIComponent(window.location.href) + '&referring_url=' + encodeURIComponent(document.referrer) + '&date=' + Date.now() + '&uuid=' + uuid;

                this.debug("Executing ajax request to track visit");
                this.debug(pixelURL);

                $.get(pixelURL, function(data) {

                    if (typeof callback !== 'undefined') {
                        self.debug("Tracking successful, execute callback");

                        callback(data);
                    }

                });

            },

            trackForms: function() {
                this.debug("AO Tracking Form");

                // AO-FORMS Tracking
                var self = this;
                var aoFormsCollection = document.querySelectorAll('.ao-form');

                // No forms found in DOM
                if (aoFormsCollection.length === 0) {
                    this.debug("No forms found");
                    return;
                }

                // Loop through all forms and append tracking information
                for (var i = 0; i < aoFormsCollection.length; i++) {

                    // Tracker Value
                    var trackerValueHiddenField = document.createElement("input");
                    trackerValueHiddenField.type = 'hidden';
                    trackerValueHiddenField.name = 'uuid';
                    trackerValueHiddenField.value = window.localStorage.getItem(self.cookie_name);

                    aoFormsCollection[i].prepend(trackerValueHiddenField);

                    // Current URL
                    var currentURLHiddenField = document.createElement("input");
                    currentURLHiddenField.type = 'hidden';
                    currentURLHiddenField.name = 'current_url';
                    currentURLHiddenField.value = window.location.href;

                    aoFormsCollection[i].prepend(currentURLHiddenField);

                }

                // Capture the forms
                this.debug("Capturing DOM submission events");

                $(document).on('submit', '.ao-form', function(e) {

                    e.preventDefault();

                    self.debug("Form submitted, triggering submit request");

                    self.submitFormRequest(
                        this
                    );

                });

            },

            submitFormRequest(form) {
                $("button[type=submit]", $(form)).html("Submitting...");
                $("button[type=submit]", $(form)).prop('disabled', true);

                var self = this;
                var form_name = $(form).data('form-name');

                this.debug("Capturing form " + form_name);

                $.ajax({
                    url: $(form).attr('action'),
                    cache: false,
                    contentType: false,
                    processData: false,
                    data: new FormData(form),
                    type: 'POST',
                    success: function(response) {

                        ao_gtm.track(form_name, $(form).serializeArray(), function() {

                            setTimeout(function() {

                                window.location = self.redirect_urls[form_name]

                            }, 2500);

                        });

                    },
                    error: function(error) {

                        alert("Please check the form for errors");

                        self.debug(status);
                        self.debug(error);

                        $("button[type=submit]", form).html("Submit");
                        $("button[type=submit]", form).prop('disabled', false);

                    }
                });
            },

            debug: function() {
                if (this.debugger) {
                    for (var i = 0; i < arguments.length; i++) {
                        console.log(arguments[i]);
                    }
                }
            }
        }

        const ao_estimate_form = {
            formStep: 0,

            init() {
                var self = this;

                $("#ao-estimate-form #previous_step").click(function() {
                    self.formStep = self.formStep - 1;
                    self.updateForm();
                });

                $("#ao-estimate-form #next_step").click(function() {
                    self.formStep = self.formStep + 1;
                    self.updateForm();
                });

                self.handleProgressMeter();

            },

            updateForm() {
                this.handlePreviousButton();
                this.handleSubmitButton();
                this.handleSectionToggling();
                this.handleProgressMeter();
            },

            handleProgressMeter() {
                let form = this.chooseFormPath();
                let formLength = form.length;
                let actualStep = this.formStep + 1;

                $("#meter")
                    .attr('aria-valuemax', formLength)
                    .attr('aria-valuenow', actualStep)
                    .css('width', ((actualStep / form.length) * 100) + '%');
            },

            handlePreviousButton() {
                $("#previous_step").prop('disabled', false);

                if (this.formStep === 0) {
                    $("#previous_step").prop('disabled', true);
                }
            },

            handleSubmitButton() {
                let form = this.chooseFormPath();

                $("#submit_button").hide();
                $("#next_step").show();

                if (form.length - 1 === this.formStep) {
                    $("#submit_button").show();
                    $("#next_step").hide();
                }
            },

            handleSectionToggling() {
                let form = this.chooseFormPath();

                for (var i = 0; i < form.length; i++) {

                    if (i === this.formStep) {

                        form[i].section.show();

                    } else {

                        form[i].section.hide();

                    }

                }
            },

            chooseFormPath() {
                let form = [];

                // Define Field Path
                if ($("input[name='new_or_existing']:checked").val() === 'Existing') {

                    form = [{
                            section: $("#section_new_or_existing"),
                            value: $("input[name='new_or_existing']:checked").val()
                        },
                        {
                            section: $("#section_code_audit"),
                            value: $("input[name='code_audit']:checked").val()
                        },
                        {
                            section: $("#section_low_budget_developers"),
                            value: $("input[name='low_budget_developers']:checked").val()
                        },
                        {
                            section: $("#section_low_budget_disclaimer"),
                            value: $("input[name='low_budget_disclaimer']").val()
                        },
                        {
                            section: $("#section_partnership_style"),
                            value: $("input[name='partnership_style']:checked").val()
                        },
                        {
                            section: $("#section_requested_services"),
                            value: $("input[name='requested_services']").val()
                        },
                        {
                            section: $("#section_project_length"),
                            value: $("input[name='project_length']:checked").val()
                        },
                        {
                            section: $("#section_dedicated_developers"),
                            value: $("input[name='dedicated_developers']:checked").val()
                        },
                        {
                            section: $("#section_kickoff_timeframe"),
                            value: $("input[name='kickoff_timeframe']:checked").val()
                        },
                        {
                            section: $("#section_contact_info"),
                            value: null
                        },
                    ];

                } else {

                    form = [{
                            section: $("#section_new_or_existing"),
                            value: $("input[name='new_or_existing']:checked").val()
                        },
                        {
                            section: $("#section_partnership_style"),
                            value: $("input[name='partnership_style']:checked").val()
                        },
                        {
                            section: $("#section_requested_services"),
                            value: $("input[name='requested_services']").val()
                        },
                        {
                            section: $("#section_project_length"),
                            value: $("input[name='project_length']:checked").val()
                        },
                        {
                            section: $("#section_dedicated_developers"),
                            value: $("input[name='dedicated_developers']:checked").val()
                        },
                        {
                            section: $("#section_kickoff_timeframe"),
                            value: $("input[name='kickoff_timeframe']:checked").val()
                        },
                        {
                            section: $("#section_contact_info"),
                            value: null
                        },
                    ];

                }

                return form;
            }

        }

        $(function() {
            {
                ao_estimate_form.init();
                ao.init();
                ao_gtm.init();
            }
        });
