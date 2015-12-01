app.filter('flattenRows', function () {
    return function (transcriptTerm) {
        var flatten = [];
        var subrows = "";
        angular.forEach(transcriptTerm, function (row) {
            subrows = row.courses.course;
            flatten.push(row);
            if (subrows) {
                angular.forEach(subrows, function (subrow) {
                    flatten.push(angular.extend(subrow, {
                        subrow: true
                    }));
                });
            }
        });
        return flatten;

    }
});

app.filter('unique', function () {
    return function (collection, keyname) {
        var output = [],
            keys = [];

        angular.forEach(collection, function (item) {
            var key = item[keyname];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });

        return output;
    };
});

app.filter('phonenumber', function () {

    return function (number) {

        if (!number) {
            return '';
        }

        number = String(number);

        var formattedNumber = number;

        var c = (number[0] == '1') ? '1 ' : '';
        number = number[0] == '1' ? number.slice(1) : number;

        // # (###) ###-#### as c (area) front-end
        var area = number.substring(0, 3);
        var front = number.substring(3, 6);
        var end = number.substring(6, 10);

        if (front) {
            formattedNumber = (c + "(" + area + ") " + front);
        }
        if (end) {
            formattedNumber += ("-" + end);
        }
        return formattedNumber;
    };
});