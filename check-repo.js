var https = require('https');
https.get('https://api.github.com/users/harofanlantam-byte/repos?per_page=30', {headers: {'User-Agent': 'node'}}, function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() {
        var repos = JSON.parse(d);
        if (Array.isArray(repos)) {
            console.log('Public repos:', repos.length);
            repos.forEach(function(r) {
                console.log(' - ' + r.name + ' | ' + (r.private ? 'PRIVATE' : 'PUBLIC') + ' | ' + r.size + 'KB');
            });
        } else {
            console.log('Error:', repos.message);
        }
    });
});