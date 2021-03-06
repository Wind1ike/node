const http = require('http');
const fs = require('fs');
const hostname = '127.0.0.1';
const port = 3000;
const phantom = require('phantom');
const cheerio=require('cheerio');
const minify = require('html-minifier').minify;
const DB_CONN_STR = 'mongodb://admin:admin@localhost:27017/Wechat'; 
let WECHAT_NAME = [];
const Mongo = require('./mongodb.js');
const wechatdb = new Mongo(DB_CONN_STR);

class WeChat{
	constructor(wecharName){
		this.wecharName = wecharName;
		this.hrefs = {};
		this.titles = [];
		this.getHomeUrl();
	}
	async getHomeUrl(){
		const url = `http://weixin.sogou.com/weixin?type=1&s_from=input&query=${encodeURI(this.wecharName)}&ie=utf8&_sug_=n&_sug_type_=`;
		const instance = await phantom.create();
		const page = await instance.createPage();
		await page.open(url);
		const content = await page.property('content');
		//this.createServer(content);
		const $ = await cheerio.load(content);
		const homeUrl = $('[uigs=account_name_0]').attr('href');
		/*let homeUrl = content.match(/uigs=\"account_name_0\" href=\"[\s\S]*?\"/g);
		homeUrl = homeUrl[0].replace(/&amp;/g, '&').replace(/uigs=\"account_name_0\" href=/g,'').replace(/\"/g, '');*/
		this.url = homeUrl;
		this.getHomeHtml();
	}
	async getHomeHtml(){
		const instance = await phantom.create();
		const page = await instance.createPage();
		await page.open(this.url);
		const content = await page.property('content');
		this.getHrefs(content);
		//this.getTitles(content);
		this.saveData();
		// this.createServer(content);

	}
	getHrefs(content){
		const _this = this;
		const $ = cheerio.load(content);

		$('.weui_media_title').each(function(){
			let title = '';
			//_this.hrefs.push($(this).attr('hrefs'));
			if($(this).children()['0'])
				title = ($(this).children()['0'].next.data.replace(/\s/g,'').replace(/[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g, '').replace(/\:|\?|\||\\|\*|\"|\<|\>/g, ''));
			else
				title = (unescape($(this).html().replace(/&#x/g,'%u').replace(/;/g,'')).replace(/\s/g, '').replace(/[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g, '').replace(/\:|\?|\||\\|\*|\"|\<|\>/g, ''));
			_this.titles.push(title);
			_this.hrefs[title] = $(this).attr('hrefs');
			console.log(title);

		});

		/*this.hrefs.forEach(function(value, index, hrefs){
			hrefs[index] = value.replace(/\/s/, 'http://mp.weixin.qq.com/s');
		});*/
		for(let title in this.hrefs)
			this.hrefs[title] = this.hrefs[title].replace(/\/s/, 'http://mp.weixin.qq.com/s');
	}
	getTitles(homeHtml){
		var begin = homeHtml.indexOf('msgList') + 10;
		var end = homeHtml.indexOf('seajs') - 11;
		var titleBegin = 0,titleEnd = 0;

		for(let i = begin;i>=begin&&i<=end;){
			let titleBegin = homeHtml.indexOf('\"title\"', i) + 9,
			titleEnd = homeHtml.indexOf('\"}', titleBegin);
			if(titleBegin<begin)
				break;
			let title = homeHtml.substring(titleBegin,titleEnd);
			this.titles.push(title.replace(/[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g, '').replace(/\:|\?|\||\\|\*|\"|\<|\>/g, ''));
			i = titleEnd + 1;
		}
		console.log(this.titles);
	}
	createServer(content){
		const server = http.createServer(function(req,res){
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/html;charset=UTF-8');
			res.end(content);
		});
		server.listen(port, hostname, function(){
		  console.log(`服务器运行在 http://${hostname}:${port}/`);
		});
	}
	saveFile(one){
		var _this = this;
		let titles = [];
		if(one === true)
			titles.push(this.titles[0]);
		else
			titles = this.titles;
		titles.forEach(async function(title, index){
			let template = '';
			http.get(_this.hrefs[title], function(res){
				res.setEncoding('utf8');
				res.on('data', function(data){
					template += data;
				});

				res.on('end',function(){
					fs.readFile('./script.html', 'utf-8',function(err, data){
						const script = data.toString();
						template = template.replace(/<script[\s\S]*?<\/script>/g, '');
						template = template.replace(/<!--[\s\S]*?-->/g, '');
						//template = template.replace(/data-src/g, 'src');
						template = template.replace(/\/0\?wx_fmt/g, '/640?wx_fmt');
						template = template.replace(/<\/body>/, `</body>${script}`);
						template = template.replace(/阅读原文/g, '');
						

						fs.mkdir(`./${_this.wecharName}`,function(){
							fs.writeFile(
								`./${_this.wecharName}/${title}.html`,
								minify(template,{
										removeComments: true,collapseWhitespace: true,minifyJS:true, minifyCSS:true
									}),
								function(err){}
							);
						});
					});
					

				});
			});
			/*const instance = await phantom.create();
			const page = await instance.createPage();
			await page.open(_this.hrefs[index]);
			template = await page.property('content');
			fs.readFile('./script.html','utf-8',function(err, data){
				var script = data.toString();
				template = template.replace(/<script[\s\S]*?<\/script>/g, '');
				template = template.replace(/<!--[\s\S]*?-->/g, '');
				template = template.replace(/<\/body>/, '</body>'+script);

				fs.writeFile(`./template/${title}.html`, template);
			});*/

		});
	}
	saveData(){
		var _this = this;
		this.titles.forEach(function(title){
			wechatdb.insertData('article', {wechat:_this.wecharName, title : title});
		});
		wechatdb.searchData({collect:'Wechat', data:{name:_this.wecharName}, index:{name:1,num:1,_id:0}, callback:function(result){
			if(result.length > 0){
				wechatdb.count('article', {wechat:_this.wecharName}, function(count){
					wechatdb.updateData({collect:'Wechat',data:{name:_this.wecharName}, set:{num:count}});
				});
				console.log(result.num );
				if(result[0].num > 0)
					_this.saveFile(true);
				else
					_this.saveFile(false);
			}
			else{
				wechatdb.count('article', {wechat:_this.wecharName}, function(count){
					wechatdb.insertData('Wechat', {name:_this.wecharName,num:count});
				});
				_this.saveFile(false);
			}
				
		}});

			
	}
}

wechatdb.searchData({collect:'Wechat', index:{name:1,_id:0}, callback:function(result){
	result.forEach(function(wechat){
		WECHAT_NAME.push(wechat.name);
	});

	let interval = 0;
	
	WECHAT_NAME.forEach(function(name){
		var wechatName = name;
		setTimeout(function(){
			var wechat = new WeChat(wechatName);
		}, interval);
		interval += 60000;
	});
}})

/*var wechat = new WeChat('woniuriji_huaizuo');*/




