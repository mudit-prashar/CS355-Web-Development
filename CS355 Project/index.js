  
/*
=======================
index.js
=======================
Student ID:23677669
=======================
*/

const http = require("http");
const https = require("https");
const url = require("url");
const querystring = require("querystring");
const crypto = require("crypto");

const host = "localhost";
const port = 3000;

const credentials = require('./auth/credentials.json');
const fs = require('fs');
let state_storage = [];
const authentication_cache = './auth/authentication-res.json';


let SpotifyPlaylistNames = [];
let NBAinfo = [];


const new_connection = function(req,res){
    if (req.url === "/") {
        let inputForm = fs.createReadStream('./html/search-form.html');
        res.writeHead(200, {"Content-Type": "text/html"});
        inputForm.pipe(res);
        
        
    }    
    else if (req.url.startsWith("/search")) {
        let request_data = "";
        req.on("data", function (chunk) {request_data += chunk;});
        req.on("end", function () {
            let user_input = url.parse(req.url, true).query;
            
            
            let state = crypto.randomBytes(20).toString("hex");
            state_storage.push({state, user_input: user_input.q});
            console.log(state_storage);
            const authorization_endpoint = "https://accounts.spotify.com/authorize";
            let uri = querystring.stringify({
                response_type:'code',
                client_id: credentials.client_id,
                redirect_uri: credentials.redirect_uri,
                scope:credentials.scope,
                state
            });
          
            res.writeHead(302, {Location: `${authorization_endpoint}?${uri}`});
            res.end();
        });
    }
    else if (req.url.startsWith("/return")) {
        let auth_response = url.parse(req.url, true).query;
        
        let previous_state = state_storage.find((state_title_pair) => state_title_pair.state === auth_response.state);
      
        if (previous_state === undefined) {
            res.writeHead(403);
            res.end("CSRF Detected, Aborting Request");
        }
        else if (auth_response.error) {
            res.writeHead(403);
            res.end("Spotify API Access Denied");
        }
        else{
            let user_input = previous_state.user_input;
            let auth_sent_time = new Date();
            const access_token_endpoint = "https://accounts.spotify.com/api/token";
            var code = auth_response.code
            var authOptions = querystring.stringify({
                    client_id : credentials.client_id,
                    client_secret : credentials.client_secret,
                  code: code,
                  redirect_uri: credentials.redirect_uri,
                  grant_type: 'authorization_code',
                  
              });
              let opt = {
                        method: "POST",
                        headers: {
                            
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Content-Length": authOptions.length
                        }
            };
            let cache_valid = false;
            if(fs.existsSync(authentication_cache)){
                let cache_content = fs.readFileSync(authentication_cache, 'utf-8');
                    cache_json = JSON.parse(cache_content);
                    if(new Date(cache_json.expiration) > Date.now()){
                        cache_valid = true;
                        }else{
                        console.log("Token expired");
                        }
                }
            if(cache_valid){
                console.log("already cache");
                create_search_req(cache_json, user_input, res);
                
                }
            else{
                let authentication_req= https.request(access_token_endpoint, opt, function( body) {
                    received_auth(body, user_input,res, auth_sent_time);   
                });
                authentication_req.on('error', function(e){
                    console.error(e);
                });
                console.log("Requesting Token");
                authentication_req.end(authOptions);
                }
        }

    }
    else  if(req.url.includes('/album-art/')){
        console.log('album-art endpoint');
        let artist = url.parse(req.url, true);
        let path = artist.pathname;
        image_stream = fs.createReadStream(`.${decodeURI(path)}`);
        res.writeHead(200,{"Content-Type": "image/jpeg"});
        image_stream.pipe(res);
        image_stream.on('error', function(err){
            console.log(err);
            res.writeHead(404);
            return res.end();
        });
    }
    else {
        res.writeHead(404);
        res.end();
    }
    

};


const received_auth = function(authentication_res,user_input,res, auth_sent_time){
    authentication_res.setEncoding("utf8");
    let body="";
    authentication_res.on("data", function(chunk){body += chunk;});
    authentication_res.on("end", function(){
        
        let spotify_auth = JSON.parse(body);
        auth_sent_time.setHours(auth_sent_time.getHours()+1);
        spotify_auth.expiration = auth_sent_time;


        console.log(spotify_auth);
        create_cache(spotify_auth);
        console.log("new cache");
  
        create_search_req(spotify_auth, user_input,res);
                
       

    })
}

const create_cache = function(spotify_auth){
    let cacheJSON = JSON.stringify(spotify_auth);
    fs.writeFile(authentication_cache, cacheJSON, (error)=>{
        if(error){
            console.log("Error occured while saving the token ");
            throw error;

        }
        console.log('The File has been saved');

    })
}
const create_search_req = function(spotify_auth, user_input, res){
    let test=""

    let opt = {
        method: "GET",
        headers: {
            'Authorization': 'Bearer ' + spotify_auth.access_token 
            
        }
    };
    let search_req_url = 'https://api.spotify.com/v1/me/playlists';
   
    let search_req = https.request(search_req_url,opt, function(search_res){
        let results = "";
        
        search_res.on('data', function(chunk){results += chunk;});
       
        search_res.on('end', function(){
            let search_res_data = JSON.parse(results);
            console.log(`Total Playlists Received: ${search_res_data.total}`)
         
                for(let i=0; i < search_res_data.total; i++ ){
                    let name = {name: search_res_data.items[i].name}
                    SpotifyPlaylistNames.push(name);
            }
                console.log(SpotifyPlaylistNames);
                console.log("Second API Call Begins")

                secondapi_call(user_input, res)
                
        })
        
    });
    search_req.end();
    

}

const secondapi_call = function(firstcharacter, res){
    let results2 = "";
    
    let search2 = https.get(`https://www.balldontlie.io/api/v1/players?search=${firstcharacter}`, (res) => {

        res.on('data', (chunk) => {
            results2 += chunk;
            
        });
        res.on('end', function(){
            let SecondApiData = JSON.parse(results2);
            console.log(`Results Received: ${SecondApiData.meta.total_count}`)
            for(let i=0; i < SecondApiData.meta.total_count; i++ ){
                let info = {
                    name: SecondApiData.data[i].first_name + ' ' + SecondApiData.data[i].last_name,
                    height:SecondApiData.data[i].height_feet,
                    weight:SecondApiData.data[i].weight_pounds,
                    teaminfo: SecondApiData.data[i].team
                }
                NBAinfo.push(info);
                console.log(NBAinfo)
            }
            
        })
      }).on('error', (e) => {
        console.error(e);
      });
      search2.end();
      let webpage = "Results Shown in Console"
      res.writeHead(200,{'Content-type':'text/html'});
      res.end(webpage);
}


const server = http.createServer(new_connection);
server.listen(port, host);
console.log(`Server now listening on ${host}:${port}`);