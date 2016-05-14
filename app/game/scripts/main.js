(function() {
    'use strict';

    var sum = {
            a: 12,
            b: 3
        };

    function setFields(sum){
        $('.field-a').text(sum.a);
        $('.field-b').text(sum.b);
        $('.field-result').val('').focus();
    }

    function checkFields(){

    }

    setFields(sum);
    $('.field-result').on('keyup', function(){
        var fieldA = parseInt($('.field-a').text()),
            fieldB = parseInt($('.field-b').text()),
            result = fieldA+fieldB,
            fieldResult = parseInt($('.field-result').val());
        console.log(result,fieldResult);
        $('.field-result').attr('maxlength', result.toString().length)
        if (result == fieldResult) {
            $('.result').removeClass('bg-light-blue bg-error').addClass('bg-success');
            return;
        }
        if (fieldResult && result.toString().length == fieldResult.toString().length) {
            $('.result').removeClass('bg-light-blue bg-success').addClass('bg-error');
            return;
        }
        $('.result').removeClass('bg-success bg-error').addClass('bg-light-blue');
    });
    
    
})();