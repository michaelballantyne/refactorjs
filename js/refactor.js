var search = function(flow, start) {
    var visited = [];
    var remaining = [start];

    while (!_.isEmpty(remaining)) {
        var next = remaining.pop();
        visited.push(next);
        
        var found = [];
        if (flow.accessToAlloc.hasOwnProperty(next)) {
            found.push.apply(found, flow.accessToAlloc[next]);
        }

        if (flow.allocToAccess.hasOwnProperty(next)) {
            found.push.apply(found, flow.allocToAccess[next]);
        }

        remaining.push.apply(remaining, _.difference(found, visited));
    }

    return _.difference(visited, start)
}

var edToLoc = function(start, end) {
    return (start.line + 1) + ":" + start.ch + "-" + (end.line + 1) + ":" + end.ch;
}

var locToEd = function(loc) {
    var result = [];
    var range = loc.split('-'); 
    var start = range[0].split(':');
    var end = range[1].split(':');
    return [{line: parseInt(start[0]) - 1, ch: parseInt(start[1])}, {line: parseInt(end[0]) - 1, ch: parseInt(end[1])}]
}

$(function() {
    keymap = {fallthrough: "default"};
    editor = CodeMirror($('#in')[0], {value: $('#initial').val(), mode: 'javascript', extraKeys: keymap, viewportMargin: Infinity});

    var markers = [];
    $(document).keypress(function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 18) {
                _.each(markers, function(marker) {
                    marker.clear();
                });
                markers = [];
                var flow = main(editor.getValue());

                var show = [];

                var start = editor.getCursor("start");
                var end = editor.getCursor("end");

                var results = _.uniq(search(flow, edToLoc(start, end)));
                var toHighlight = _.map(results, locToEd);

                if (!(toHighlight.length > 0)) {
                    return;
                }

                var primaryMarker = editor.markText(start, end, 
                            {className: "marked",
                             inclusiveRight: true});

                _.each(toHighlight, function(edRange) {
                    markers.push(editor.markText(edRange[0], edRange[1], 
                            {className: "marked",
                             inclusiveRight: true}));
                });

                editor.setCursor(end);

                var changing = false;
                var changeHandler = function() {
                    if (!changing) {
                        changing = true;
                        var mark = primaryMarker.find()
                        var text = editor.getRange(mark.from, mark.to);
                        var i;
                        for (i = 0; i < markers.length; i++) {
                            mark = markers[i].find();
                            editor.replaceRange(text, mark.from, mark.to);
                            markers[i].clear();
                            mark.to.ch = mark.from.ch + text.length;
                            markers[i] = editor.markText(mark.from, mark.to,
                                {className: "marked",
                                    inclusiveRight: true});
                        }
                        changing = false;
                    }
                };

                editor.on("change", changeHandler);

                keymap.Enter = function(cm) {
                    editor.off("change", changeHandler);
                    delete keymap.Enter;
                    for (i = 0; i < markers.length; i++) {
                        markers[i].clear();
                        primaryMarker.clear();
                    }
                }
            }
        }
    });

    $('#run').click(function(e) {
        main($('#in').val());
    });
});
