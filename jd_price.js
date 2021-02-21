<<<<<<< HEAD
/**
 * 京东保价
 * 京东 api 只能查询60天的订单
 * 保价期限是以物流签收时间为准的，30天是最长保价期。
 * 所以订单下单时间以及发货、收货时间，也可能占用很多天，60天内的订单进行保价是正常的。
 * 没进行过保价的60天内的订单。查询一次，不符合保价的，不会再次申请保价。
 *
 * 支持云端cookie使用
 * 修改自：https://raw.githubusercontent.com/ZCY01/daily_scripts/main/jd/jd_priceProtect.js
 * 修改自：https://raw.githubusercontent.com/id77/QuantumultX/master/task/jdGuaranteedPrice.js
 *
 * 京东保价页面脚本：https://static.360buyimg.com/siteppStatic/script/priceskus-phone.js
 *
 *
 * > iOS同时支持使用 NobyDa 与 domplin 脚本的京东 cookie
 *
 */

const $ = new Env('京东保价');

const selfDomain = 'https://msitepp-fm.jd.com/';
const unifiedGatewayName = 'https://api.m.jd.com/';
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
let cookiesArr = [];
if ($.isNode()) {
  Object.keys(jdCookieNode).forEach((item) => {
    cookiesArr.push(jdCookieNode[item])
  })
  if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {};
} else {
  cookiesArr = [$.getdata('CookieJD'), $.getdata('CookieJD2'), ...jsonParse($.getdata('CookiesJD') || "[]").map(item => item.cookie)].filter(item => !!item);
}

!(async () => {
  if (!cookiesArr[0]) {
    $.msg(
      $.name,
      '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取',
      'https://bean.m.jd.com/',
      {
        'open-url': 'https://bean.m.jd.com/',
      }
    );
    return;
  }
  for (let i = 0; i < cookiesArr.length; i++) {
    if (cookiesArr[i]) {
      $.cookie = cookiesArr[i];
      $.UserName = decodeURIComponent(
        $.cookie.match(/pt_pin=(.+?);/) && $.cookie.match(/pt_pin=(.+?);/)[1]
      );
      $.index = i + 1;
      $.isLogin = false;
      $.nickName = '';
      await totalBean();
      if (!$.isLogin) {
        $.msg(
          $.name,
          `【提示】cookie已失效`,
          `京东账号${$.index} ${
            $.nickName || $.UserName
          }\n请重新登录获取\nhttps://bean.m.jd.com/`,
          {
            'open-url': 'https://bean.m.jd.com/',
          }
        );
        continue;
      }
      console.log(
        `\n***********开始【账号${$.index}】${
          $.nickName || $.UserName
        }********\n`
      );
      $.hasNext = true;
      $.refundtotalamount = 0;
      $.orderList = new Array();
      $.applyMap = {};
      // TODO
      $.token = '';
      $.feSt = 'f';
      console.log(`💥 获得首页面，解析超参数`);
      await getHyperParams();
      // console.log($.HyperParam)
      console.log(`----------`);
      console.log(`🧾 获取所有价格保护列表，排除附件商品`);
      for (let page = 1; $.hasNext; page++) {
        await getApplyData(page);
      }
      console.log(`----------`);
      console.log(`🗑 删除不符合订单`);
      console.log(`----------`);
      let taskList = [];
      for (let order of $.orderList) {
        taskList.push(historyResultQuery(order));
      }
      await Promise.all(taskList);
      console.log(`----------`);
      console.log(`📊 ${$.orderList.length}个商品即将申请价格保护！`);
      console.log(`----------`);
      for (let order of $.orderList) {
        await skuApply(order);
        await $.wait(300);
      }
      console.log(`----------`);
      console.log(`⏳ 等待申请价格保护结果...`);
      console.log(`----------`);
      for (let i = 1; i <= 30 && Object.keys($.applyMap).length > 0; i++) {
        await $.wait(1000);
        if (i % 5 == 0) {
          await getApplyResult();
        }
      }
      showMsg();
    }
  }
})()
  .catch((e) => {
    console.log(`❗️ ${$.name} 运行错误！\n${e}`);
  })
  .finally(() => $.done());

const getValueById = function (text, id) {
  try {
    const reg = new RegExp(`id="${id}".*value="(.*?)"`);
    const res = text.match(reg);
    return res[1];
  } catch (e) {
    throw new Error(`getValueById:${id} err`);
  }
};

function getHyperParams() {
  return new Promise((resolve, reject) => {
    const options = {
      url: 'https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu',
      headers: {
        Host: 'msitepp-fm.jd.com',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Connection: 'keep-alive',
        Cookie: $.cookie,
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'zh-cn',
        Referer: 'https://ihelp.jd.com/',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    };
    $.get(options, (err, resp, data) => {
      try {
        if (err) throw new Error(JSON.stringify(err));
        $.HyperParam = {
          sid_hid: getValueById(data, 'sid_hid'),
          type_hid: getValueById(data, 'type_hid'),
          isLoadLastPropriceRecord: getValueById(
            data,
            'isLoadLastPropriceRecord'
          ),
          isLoadSkuPrice: getValueById(data, 'isLoadSkuPrice'),
          RefundType_Orderid_Repeater_hid: getValueById(
            data,
            'RefundType_Orderid_Repeater_hid'
          ),
          isAlertSuccessTip: getValueById(data, 'isAlertSuccessTip'),
          forcebot: getValueById(data, 'forcebot'),
          useColorApi: getValueById(data, 'useColorApi'),
        };
      } catch (e) {
        reject(
          `⚠️ ${arguments.callee.name.toString()} API返回结果解析出错\n${e}\n${JSON.stringify(
            data
          )}`
        );
      } finally {
        resolve();
      }
    });
  });
}

function getApplyData(page) {
  return new Promise((resolve, reject) => {
    $.hasNext = false;
    const { sid_hid, type_hid, forcebot } = $.HyperParam;
    const pageSize = 5;

    let paramObj = {
      page,
      pageSize,
      keyWords: '',
      sid: sid_hid,
      type: type_hid,
      forcebot,
      token: $.token,
      feSt: $.feSt,
    };

    $.post(taskUrl('siteppM_priceskusPull', paramObj), (err, resp, data) => {
      try {
        if (err) {
          console.log(
            `🚫 ${arguments.callee.name.toString()} API请求失败，请检查网路\n${JSON.stringify(
              err
            )}`
          );
        } else {
          let pageErrorVal = data.match(
            /id="pageError_\d+" name="pageError_\d+" value="(.*?)"/
          )[1];
          if (pageErrorVal == 'noexception') {
            let pageDatasSize = eval(
              data.match(
                /id="pageSize_\d+" name="pageSize_\d+" value="(.*?)"/
              )[1]
            );
            $.hasNext = pageDatasSize >= pageSize;
            let orders = [...data.matchAll(/skuApply\((.*?)\)/g)];
            let titles = [...data.matchAll(/<p class="name">(.*?)<\/p>/g)];
            for (let i = 0; i < orders.length; i++) {
              let info = orders[i][1].split(',');
              if (info.length != 4) {
                throw new Error(`价格保护 ${order[1]}.length != 4`);
              }
              const item = {
                orderId: eval(info[0]),
                skuId: eval(info[1]),
                sequence: eval(info[2]),
                orderCategory: eval(info[3]),
                title: `🛒${titles[i][1].substr(0, 15)}🛒`,
              };
              let id = `skuprice_${item.orderId}_${item.skuId}_${item.sequence}`;
              let reg = new RegExp(`${id}.*?isfujian="(.*?)"`);
              isfujian = data.match(reg)[1];
              if (isfujian == 'false') {
                let skuRefundTypeDiv_orderId = `skuRefundTypeDiv_${item.orderId}`;
                item['refundtype'] = getValueById(
                  data,
                  skuRefundTypeDiv_orderId
                );
                // 设置原路返还
                if (item.refundtype === '2') item.refundtype = '1';
                $.orderList.push(item);
              }
              //else...尊敬的顾客您好，您选择的商品本身为赠品，是不支持价保的呦，请您理解。
            }
          }
        }
      } catch (e) {
        reject(
          `⚠️ ${arguments.callee.name.toString()} API返回结果解析出错\n${e}\n${JSON.stringify(
            data
          )}`
        );
      } finally {
        resolve();
      }
    });
  });
}

//  申请按钮
function skuApply(order) {
  return new Promise((resolve, reject) => {
    const { orderId, orderCategory, skuId, refundtype } = order;
    const { sid_hid, type_hid, forcebot } = $.HyperParam;

    let paramObj = {
      orderId,
      orderCategory,
      skuId,
      sid: sid_hid,
      type: type_hid,
      refundtype,
      forcebot,
      token: $.token,
      feSt: $.feSt,
    };

    console.log(`🈸 ${order.title}`);
    $.post(taskUrl('siteppM_proApply', paramObj), (err, resp, data) => {
      try {
        if (err) {
          console.log(
            `🚫 ${arguments.callee.name.toString()} API请求失败，请检查网路\n${JSON.stringify(
              err
            )}`
          );
        } else {
          data = JSON.parse(data);
          if (data.flag) {
            if (data.proSkuApplyId != null) {
              $.applyMap[data.proSkuApplyId[0]] = order;
            }
          } else {
            console.log(`🚫 ${order.title} 申请失败：${data.errorMessage}`);
          }
        }
      } catch (e) {
        reject(
          `⚠️ ${arguments.callee.name.toString()} API返回结果解析出错\n${e}\n${JSON.stringify(
            data
          )}`
        );
      } finally {
        resolve();
      }
    });
  });
}

// 历史结果查询
function historyResultQuery(order) {
  return new Promise((resolve, reject) => {
    const { orderId, sequence, skuId } = order;
    const { sid_hid, type_hid, forcebot } = $.HyperParam;

    let paramObj = {
      orderId,
      skuId,
      sequence,
      sid: sid_hid,
      type: type_hid,
      pin: undefined,
      forcebot,
    };

    const reg = new RegExp(
      'overTime|[^库]不支持价保|无法申请价保|请用原订单申请'
    );
    let deleted = true;
    $.post(taskUrl('siteppM_skuProResultPin', paramObj), (err, resp, data) => {
      try {
        if (err) {
          console.log(
            `🚫 ${arguments.callee.name.toString()} API请求失败，请检查网路\n${JSON.stringify(
              err
            )}`
          );
        } else {
          deleted = reg.test(data);
        }
      } catch (e) {
        reject(
          `⚠️ ${arguments.callee.name.toString()} API返回结果解析出错\n${e}\n${JSON.stringify(
            data
          )}`
        );
      } finally {
        if (deleted) {
          console.log(`🚫 删除商品：${order.title}`);
          $.orderList = $.orderList.filter((item) => {
            return item.orderId != order.orderId || item.skuId != order.skuId;
          });
        }
        resolve();
      }
    });
  });
}

function getApplyResult() {
  function handleApplyResult(ajaxResultObj) {
    if (
      ajaxResultObj.hasResult != 'undefined' &&
      ajaxResultObj.hasResult == true
    ) {
      //有结果了
      let proSkuApplyId = ajaxResultObj.applyResultVo.proSkuApplyId; //申请id
      let order = $.applyMap[proSkuApplyId];
      delete $.applyMap[proSkuApplyId];
      if (ajaxResultObj.applyResultVo.proApplyStatus == 'ApplySuccess') {
        //价保成功
        $.refundtotalamount += ajaxResultObj.applyResultVo.refundtotalamount;
        console.log(
          `📋 ${order.title} \n🟢 申请成功：￥${$.refundtotalamount}`
        );
        console.log(`-----`);
      } else {
        console.log(
          `📋 ${order.title} \n🔴 申请失败：${ajaxResultObj.applyResultVo.failTypeStr} \n🔴 失败类型:${ajaxResultObj.applyResultVo.failType}`
        );
        console.log(`-----`);
      }
    }
  }
  return new Promise((resolve, reject) => {
    let proSkuApplyIds = Object.keys($.applyMap).join(',');
    const { pin, type_hid } = $.HyperParam;

    let paramObj = {
      proSkuApplyIds,
      pin,
      type: type_hid,
    };

    $.post(taskUrl('siteppM_moreApplyResult', paramObj), (err, resp, data) => {
      try {
        if (err) {
          console.log(
            `🚫 ${arguments.callee.name.toString()} API请求失败，请检查网路\n${JSON.stringify(
              err
            )}`
          );
        } else if (data) {
          data = JSON.parse(data);
          let resultArray = data.applyResults;
          for (let i = 0; i < resultArray.length; i++) {
            let ajaxResultObj = resultArray[i];
            handleApplyResult(ajaxResultObj);
          }
        }
      } catch (e) {
        reject(
          `⚠️ ${arguments.callee.name.toString()} API返回结果解析出错\n${e}\n${JSON.stringify(
            data
          )}`
        );
      } finally {
        resolve();
      }
    });
  });
}

function taskUrl(functionid, body) {
  let urlStr = selfDomain + 'rest/priceprophone/priceskusPull';
  const { useColorApi, forcebot } = $.HyperParam;

  if (useColorApi == 'true') {
    urlStr =
      unifiedGatewayName +
      'api?appid=siteppM&functionId=' +
      functionid +
      '&forcebot=' +
      forcebot +
      '&t=' +
      new Date().getTime();
  }
  return {
    url: urlStr,
    headers: {
      Host: useColorApi == 'true' ? 'api.m.jd.com' : 'msitepp-fm.jd.com',
      Accept: '*/*',
      'Accept-Language': 'zh-cn',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://msitepp-fm.jd.com',
      Connection: 'keep-alive',
      Referer: 'https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu',
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      Cookie: $.cookie,
    },
    body: body ? `body=${JSON.stringify(body)}` : undefined,
  };
}

function showMsg() {
  console.log(`🧮 本次价格保护金额：${$.refundtotalamount}💰`);
  if ($.refundtotalamount) {
    $.msg(
      $.name,
      ``,
      `京东账号${$.index} ${$.nickName || $.UserName}\n🎉 本次价格保护金额：${
        $.refundtotalamount
      }💰`,
      {
        'open-url':
          'https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu',
      }
    );
  }
}

function totalBean() {
  return new Promise((resolve) => {
    const options = {
      url: `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
      headers: {
        Accept: 'application/json,text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-cn',
        Connection: 'keep-alive',
        Cookie: $.cookie,
        Referer: 'https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      },
    };
    $.post(options, (err, resp, data) => {
      try {
        if (err) {
          console.log(`${JSON.stringify(err)}`);
          console.log(`${$.name} API请求失败，请检查网路重试`);
        } else {
          if (data) {
            data = JSON.parse(data);
            if (data['retcode'] === 13) {
              return;
            }
            $.isLogin = true;
            $.nickName = data['base'].nickname;
          } else {
            console.log(`京东服务器返回空数据`);
          }
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function jsonParse(str) {
  if (typeof str == 'string') {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.log(e);
      $.msg(
        $.name,
        '',
        '请勿随意在BoxJs输入框修改内容\n建议通过脚本去获取cookie'
      );
      return [];
    }
  }
}
// https://github.com/chavyleung/scripts/blob/master/Env.js
// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getJson(t,e){let s=e;const i=this.getData(t);if(i)try{s=JSON.parse(this.getData(t))}catch{}return s}setjson(t,e){try{return this.setData(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getData("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getData("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getData(t){let e=this.getVal(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getVal(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setData(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getVal(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setVal(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setVal(JSON.stringify(o),i)}}else s=this.setVal(t,e);return s}getVal(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setVal(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
=======
/*
README：https://github.com/yichahucha/surge/tree/master
 */

const path1 = "serverConfig";
const path2 = "wareBusiness";
const path3 = "basicConfig";
const consolelog = false;
const url = $request.url;
const body = $response.body;
const $tool = tool();

if (url.indexOf(path1) != -1) {
    let obj = JSON.parse(body);
    delete obj.serverConfig.httpdns;
    delete obj.serverConfig.dnsvip;
    delete obj.serverConfig.dnsvip_v6;
    $done({ body: JSON.stringify(obj) });
}

if (url.indexOf(path3) != -1) {
    let obj = JSON.parse(body);
    let JDHttpToolKit = obj.data.JDHttpToolKit;
    if (JDHttpToolKit) {
        delete obj.data.JDHttpToolKit.httpdns;
        delete obj.data.JDHttpToolKit.dnsvipV6;
    }
    $done({ body: JSON.stringify(obj) });
    $done({ body });
}

if (url.indexOf(path2) != -1) {
    let obj = JSON.parse(body);
    const floors = obj.floors;
    const commodity_info = floors[floors.length - 1];
    const shareUrl = commodity_info.data.property.shareUrl;
    request_history_price(shareUrl, function(data) {
        if (data) {
            const lowerword = adword_obj();
            lowerword.data.ad.textColor = "#fe0000";
            let bestIndex = 0;
            for (let index = 0; index < floors.length; index++) {
                const element = floors[index];
                if (element.mId == lowerword.mId) {
                    bestIndex = index + 1;
                    break;
                } else {
                    if (element.sortId > lowerword.sortId) {
                        bestIndex = index;
                        break;
                    }
                }
            }
            if (data.ok == 1 && data.single) {
                const lower = lowerMsgs(data.single)
                const detail = priceSummary(data)
                const tip = data.PriceRemark.Tip + "（仅供参考）"
                lowerword.data.ad.adword = `${lower} ${tip}\n${detail}`;
                floors.insert(bestIndex, lowerword);
            }
            if (data.ok == 0 && data.msg.length > 0) {
                lowerword.data.ad.adword = "⚠️ " + data.msg;
                floors.insert(bestIndex, lowerword);
            }
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({ body });
        }
    })
}

function lowerMsgs(data) {
    const lower = data.lowerPriceyh
    const lowerDate = dateFormat(data.lowerDateyh)
    const lowerMsg = "〽️历史最低到手价：¥" + String(lower) + ` (${lowerDate}) `
    return lowerMsg
}

function priceSummary(data) {
    let summary = ""
    let listPriceDetail = data.PriceRemark.ListPriceDetail
    listPriceDetail.pop()
    let list = listPriceDetail.concat(historySummary(data.single))
    list.forEach((item, index) => {
        if (item.Name == "双11价格") {
            item.Name = "双十一价格"
        } else if (item.Name == "618价格") {
            item.Name = "六一八价格"
        } else if (item.Name == "30天最低价") {
            item.Name = "三十天最低"
        }
        summary += `\n${item.Name}${getSpace(8)}${item.Price}${getSpace(8)}${item.Date}${getSpace(8)}${item.Difference}`
    })
    return summary
}

function historySummary(single) {
    const rexMatch = /\[.*?\]/g;
    const rexExec = /\[(.*),(.*),"(.*)".*\]/;
    let currentPrice, lowest60, lowest180, lowest360
    let list = single.jiagequshiyh.match(rexMatch);
    list = list.reverse().slice(0, 360);
    list.forEach((item, index) => {
        if (item.length > 0) {
            const result = rexExec.exec(item);
            const dateUTC = new Date(eval(result[1]));
            const date = dateUTC.format("yyyy-MM-dd");
            let price = parseFloat(result[2]);
            if (index == 0) {
                currentPrice = price
                lowest60 = { Name: "六十天最低", Price: `¥${String(price)}`, Date: date, Difference: difference(currentPrice, price), price }
                lowest180 = { Name: "一百八最低", Price: `¥${String(price)}`, Date: date, Difference: difference(currentPrice, price), price }
                lowest360 = { Name: "三百六最低", Price: `¥${String(price)}`, Date: date, Difference: difference(currentPrice, price), price }
            }
            if (index < 60 && price <= lowest60.price) {
                lowest60.price = price
                lowest60.Price = `¥${String(price)}`
                lowest60.Date = date
                lowest60.Difference = difference(currentPrice, price)
            }
            if (index < 180 && price <= lowest180.price) {
                lowest180.price = price
                lowest180.Price = `¥${String(price)}`
                lowest180.Date = date
                lowest180.Difference = difference(currentPrice, price)
            }
            if (index < 360 && price <= lowest360.price) {
                lowest360.price = price
                lowest360.Price = `¥${String(price)}`
                lowest360.Date = date
                lowest360.Difference = difference(currentPrice, price)
            }
        }
    });
    return [lowest60, lowest180, lowest360];
}

function difference(currentPrice, price) {
    let difference = sub(currentPrice, price)
    if (difference == 0) {
        return "-"
    } else {
        return `${difference > 0 ? "↑" : "↓"}${String(difference)}`
    }
}

function sub(arg1, arg2) {
    return add(arg1, -Number(arg2), arguments[2]);
}

function add(arg1, arg2) {
    arg1 = arg1.toString(), arg2 = arg2.toString();
    var arg1Arr = arg1.split("."),
        arg2Arr = arg2.split("."),
        d1 = arg1Arr.length == 2 ? arg1Arr[1] : "",
        d2 = arg2Arr.length == 2 ? arg2Arr[1] : "";
    var maxLen = Math.max(d1.length, d2.length);
    var m = Math.pow(10, maxLen);
    var result = Number(((arg1 * m + arg2 * m) / m).toFixed(maxLen));
    var d = arguments[2];
    return typeof d === "number" ? Number((result).toFixed(d)) : result;
}

function request_history_price(share_url, callback) {
    const options = {
        url: "https://apapia-history.manmanbuy.com/ChromeWidgetServices/WidgetServices.ashx",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 - mmbWebBrowse - ios"
        },
        body: "methodName=getHistoryTrend&p_url=" + encodeURIComponent(share_url)
    }
    $tool.post(options, function(error, response, data) {
        if (!error) {
            callback(JSON.parse(data));
            if (consolelog) console.log("Data:\n" + data);
        } else {
            callback(null, null);
            if (consolelog) console.log("Error:\n" + error);
        }
    })
}

function dateFormat(cellval) {
    const date = new Date(parseInt(cellval.replace("/Date(", "").replace(")/", ""), 10));
    const month = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
    const currentDate = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
    return date.getFullYear() + "-" + month + "-" + currentDate;
}

function getSpace(length) {
    let blank = "";
    for (let index = 0; index < length; index++) {
        blank += " ";
    }
    return blank;
}

function adword_obj() {
    return {
        "bId": "eCustom_flo_199",
        "cf": {
            "bgc": "#ffffff",
            "spl": "empty"
        },
        "data": {
            "ad": {
                "adword": "",
                "textColor": "#8C8C8C",
                "color": "#f23030",
                "newALContent": true,
                "hasFold": true,
                "class": "com.jd.app.server.warecoresoa.domain.AdWordInfo.AdWordInfo",
                "adLinkContent": "",
                "adLink": ""
            }
        },
        "mId": "bpAdword",
        "refId": "eAdword_0000000028",
        "sortId": 13
    }
}

function tool() {
    const isSurge = typeof $httpClient != "undefined"
    const isQuanX = typeof $task != "undefined"
    const isResponse = typeof $response != "undefined"
    const node = (() => {
        if (typeof require == "function") {
            const request = require('request')
            return ({ request })
        } else {
            return (null)
        }
    })()
    const notify = (title, subtitle, message) => {
        if (isQuanX) $notify(title, subtitle, message)
        if (isSurge) $notification.post(title, subtitle, message)
        if (node) console.log(JSON.stringify({ title, subtitle, message }));
    }
    const write = (value, key) => {
        if (isQuanX) return $prefs.setValueForKey(value, key)
        if (isSurge) return $persistentStore.write(value, key)
    }
    const read = (key) => {
        if (isQuanX) return $prefs.valueForKey(key)
        if (isSurge) return $persistentStore.read(key)
    }
    const adapterStatus = (response) => {
        if (response) {
            if (response.status) {
                response["statusCode"] = response.status
            } else if (response.statusCode) {
                response["status"] = response.statusCode
            }
        }
        return response
    }
    const get = (options, callback) => {
        if (isQuanX) {
            if (typeof options == "string") options = { url: options }
            options["method"] = "GET"
            $task.fetch(options).then(response => {
                callback(null, adapterStatus(response), response.body)
            }, reason => callback(reason.error, null, null))
        }
        if (isSurge) $httpClient.get(options, (error, response, body) => {
            callback(error, adapterStatus(response), body)
        })
        if (node) {
            node.request(options, (error, response, body) => {
                callback(error, adapterStatus(response), body)
            })
        }
    }
    const post = (options, callback) => {
        if (isQuanX) {
            if (typeof options == "string") options = { url: options }
            options["method"] = "POST"
            $task.fetch(options).then(response => {
                callback(null, adapterStatus(response), response.body)
            }, reason => callback(reason.error, null, null))
        }
        if (isSurge) {
            $httpClient.post(options, (error, response, body) => {
                callback(error, adapterStatus(response), body)
            })
        }
        if (node) {
            node.request.post(options, (error, response, body) => {
                callback(error, adapterStatus(response), body)
            })
        }
    }
    return { isQuanX, isSurge, isResponse, notify, write, read, get, post }
}

Array.prototype.insert = function(index, item) {
    this.splice(index, 0, item);
};

Date.prototype.format = function(fmt) {
    var o = {
        "y+": this.getFullYear(),
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S+": this.getMilliseconds()
    };
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            if (k == "y+") {
                fmt = fmt.replace(RegExp.$1, ("" + o[k]).substr(4 - RegExp.$1.length));
            } else if (k == "S+") {
                var lens = RegExp.$1.length;
                lens = lens == 1 ? 3 : lens;
                fmt = fmt.replace(RegExp.$1, ("00" + o[k]).substr(("" + o[k]).length - 1, lens));
            } else {
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            }
        }
    }
    return fmt;
}
>>>>>>> 15186cfc1169b22a586cae8179db65ecc84e2344
