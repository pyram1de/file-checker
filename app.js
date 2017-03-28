var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var app = express();
var port = 8020;
var ejs = require('ejs');
var bodyParser = require('body-parser');
var mongojs = require('mongojs');//.connect('mongodb://localhost:27017',['calculation']);
var db = mongojs('mongodb://localhost:27017/filechecker',['calculation']);
var styles = {
    processing: 'background: #9e8d8c url(\'http://www.bootply.com/assets/example/pt_squares_lg.png\') repeat center center fixed',
    error: 'background: #ed2c25 url(\'http://www.bootply.com/assets/example/pt_squares_lg.png\') repeat center center fixed',
    complete : 'background: #11cc45 url(\'http://www.bootply.com/assets/example/pt_squares_lg.png\') repeat center center fixed'
}
var ObjectId = mongojs.ObjectId;
var calculationName = "";
var expectedFileCount = 0;
var calculations = [];
var pause = undefined;
app.set('view engine', 'ejs')

app.use(express.static('public'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.set('views',__dirname+'\\src\\views');

var checkFileCount = function(calculation){
    var time = 0,
        filecount = 0;
    try{
        files = fs.readdirSync(calculation.location);
    } catch(something) {
        calculation.style = styles.error;
        calculation.currentStatus = "Folder Not Found " + something;
        return calculation;
    }
    var fileCount = files.length;    
    if(fileCount>=calculation.expectedFileCount) {  
        calculation.percentage =  Math.floor((fileCount / calculation.expectedFileCount) * 100);      
        calculation.style =  styles.complete;
        calculation.currentStatus = 'Complete.';
    } 
    else if(calculation.currentNumber==fileCount){    
        calculation.ticks = calculation.ticks + 1;
        if(calculation.ticks>calculation.threshold){
            calculation.currentStatus = 'WARNING files ceased progress ';
            calculation.style = styles.error;
        }
    } else {        
        calculation.ticks = 0;
        calculation.percentage =  Math.floor((fileCount / calculation.expectedFileCount) * 100);
        calculation.currentStatus = 'File count currently at ' + files.length;
        calculation.style =  styles.processing;
    }
    calculation.previousNumber = calculation.currentNumber;
    calculation.currentNumber = files.length;
    return calculation;
}

var getCalculations = function(cb) {
    db.calculations.find({},function(err, found){
        if(found.length===0){        
            var calculation = {
                calculationName: "empty",
                expectedFileCount: 2000,
                location: 'Z:\\USS Ltd\\',
                currentNumber: 50,
                currentStatus: "initial",
                style: styles.processing,
                ticks: 0,
                server: "server",
                previousNumber: 0
            }
            db.calculations.save(calculation, function(err, saved){
                calculations.push(saved);
                if(cb){
                    cb(null, calculations);
                }
            });
        } else {
            calculations = found;
            if(cb){
                cb(null, calculations);
            }
        }
    });
}

var process_calculations = function(){
    getCalculations(function(err,calcs){
        calcs.forEach(function(calculation) {
            var c = checkFileCount(calculation);
            db.calculations.save(c, function(err, saved){
            });
        }, this);
    });
}

var pollCalc = function(calc){
    db.calculations.findOne({
        "_id": ObjectId(calc._id)
    }, function(err, theCalculation){
        var pollTime;
        pollTime = theCalculation.pollTime;
        if(pause){
            return setTimeout(pollCalc.bind(null,theCalculation), pollTime);
        }
        var c = checkFileCount(theCalculation);
        db.calculations.save(c, function(err, saved){     
            for(var i = 0; i < calculations.length; i++){
                if(ObjectId(calculations[i]._id).toString()===ObjectId(saved._id).toString()){
                    calculations.splice(i);
                    break;
                }
            }
            calculations.push(saved);
            setTimeout(pollCalc.bind(null,saved), pollTime);
        });
    });
}

var setUpCalcs = function(){
    getCalculations(function(err,calcs){
        calcs.forEach(function(calculation) {
            pollCalc(calculation);            
        });
    });
}

setUpCalcs();

app.get('/', function (req, res) {
    res.render('index', {
        calculations: calculations
    });
});

app.get('/update', function(req,res){
    res.json({
        calculations: calculations
    });
});
app.get('/admin', function(req, res){
    res.render('indexadmin', {
        calculations: calculations
    });
});

app.get('/admin/:id', function(req, res){      
    db.calculations.findOne({
        "_id": new ObjectId(req.params.id)
    }, function(err, calculation){
        res.render('admin', {
            calculation: calculation
        });
    });
});

app.post('/admin/:id', function(req, res){   
    pause = true;   
    var calcId = req.body.id;
    db.calculations.findOne({
        "_id" : new ObjectId(calcId)
    }, function(err, calculation){
        calculation.calculationName = req.body.calculationName;
        calculation.expectedFileCount =  req.body.expectedCount;
        calculation.location = req.body.location;
        calculation.server = req.body.server;
        calculation.percentage = 0;
        calculation.currentNumber=0;
        calculation.previousNumber=  Number(req.body.previousNumber,10)||calculation.previousNumber;
        calculation.ticks=0;
        calculation.threshold = Number(req.body.threshold,10)||calculation.threshold;
        calculation.pollTime=req.body.pollTime||calculation.pollTime;
        db.calculations.save(calculation, function(err, saved){
            pause = undefined;
            getCalculations(function(){
                // once calculations have been gotten, return
                res.redirect('/');
            });            
        });
    });            
});

app.get('/add', function(req, res){
    var pause =true;
    var calculation = {
                calculationName: "empty",
                expectedFileCount: 2000,
                location: 'Z:\\USS Ltd\\',
                currentNumber: 50,
                currentStatus: "initial",
                style: styles.processing,
                ticks: 0,
                server: "server",
                previousNumber: 0,
                pollTime: 30000
            }
    db.calculations.save(calculation, function(err, saved){
        calculations.push(saved);
            res.send('done');
            pause = undefined;
    });   
})

app.listen(port, function(err, something){
    console.log('listening on port ' + port);
});