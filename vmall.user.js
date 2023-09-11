// ==UserScript==
// @namespace    vmall-rush-to-buy
// @version      0.0.5
// @description  try to take over the world!
// @author       syasf
// @license      MIT
// @match        https://www.vmall.com/product/*.html
// @match        https://www.vmall.com/order/confirmDepositNew*
// @require      https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/jquery/3.5.1/jquery.min.js
// @require      https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/vue/2.6.14/vue.js
// @require      https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/element-ui/2.15.7/index.js
// @updateURL    https://github.com/toUndefined/Tampermonkey/vmall.user.js
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

GM_addStyle(`
  @import url('https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/element-ui/2.15.7/theme-chalk/index.css');
`)

Vue.use(ELEMENT)

let i = 0;

renderPluginApp()

function renderPluginApp() {
  const template = `
    <template id="pluginApp-template">
      <div id="pluginApp-log" :style="{ transform: visible ? '' : 'translateX(-100%)' }">
        <el-button type="primary" plain @click="visible = !visible" size="mini" style="position: absolute; top: 0; right: 0;transform: translateX(100%)">
          {{ visible ? '隐藏' : '显示' }}
        </el-button>
        <div class="logs">
          <p v-for="(item, index) of logs" :key="index" class="log" :class="{ error: item.error, success: item.success }">{{ item.message }}</p>
        </div>
      </div>
    </template>`
  $(`
    <style>
      #pluginApp-log {
        position: fixed;
        top: 150px;
        left: 0px;
        z-index: 999999;
        transition: all 0.3s;
      }
      #pluginApp-log .logs {
        width: 400px;
        min-height: 100px;
        max-height: 350px;
        padding: 10px 2px 20px;
        border: 1px solid #eee;
        color: #333;
        overflow: scroll;
        line-height: 18px;
        font-size: 16px;
        background: #e8e8e8;
        border: 1px solid #000;
        border-radius: 0 5px 5px 0;
      }
      #pluginApp-log .log.error {
        color: red;
      }
      #pluginApp-log .log.success {
        color: green;
      }
      #pluginApp-log .log {
      }
    </style>
    <div id="pluginApp">${template}</div>
  `)
    .appendTo('body')

  const data = function () {
    return {
      visible: GM_getValue('visible', true),
      logs: GM_getValue('logs', [])
    }
  }

  const computed = {}

  const watch = {
    visible(val) {
      GM_setValue('visible', val)
    }
  }

  const hooks = {
    created() {
      const timer = setInterval(() => {
        if (location.href.indexOf('order/confirmDepositNew') > -1) {
          this.submitOrder(timer)
        } else {
          this.watchShop(timer)
        }
      }, 50);
    }
  }

  const methods = {
    watchShop(timer) {
      const btnBuy = $('#pro-operation .product-button02');
      const btnBuyText = btnBuy.text()?.trim();

      if (btnBuyText === '立即登录') {
        this.notify('未登录,请先登录!', 'error')
        clearInterval(timer);
        return
      }

      if (['暂未开售', '暂时缺货', '到货通知'].includes(btnBuyText)) {
        const msg = btnBuyText + '抢购未开始或已结束'
        this.notify(msg, error)
        this.logger(msg, { error: true })
        clearInterval(timer);
        return
      }

      if (!ec.product.skuSelect()) {
        this.logger('未选择商品规格, 请选择', { error: true })
        clearInterval(timer);
        return
      }

      let msg = '开始抢购,等待页面跳转...请勿离开或者刷新页面'
      if (btnBuyText === '支付订金') {
        // 订金模式
        this.startPay(timer, () => {
          if ($("#product-recommend-all .product-recommend-operation .product-button02").length > 0) {
            setTimeout(() => {
              ec.product.payDepositNew(3)
            }, 100)
            dealDepositInfoNew(3)
          } else {
            setTimeout(() => {
              ec.product.payDepositNew(1)
            }, 100)
            dealDepositInfoNew(1)
          }
        })
        this.notify(msg);
        this.logger(msg, { success: true })
      } else if (btnBuyText === '立即下单') {
        this.startPay(timer, () => ec.product.orderNow())
        this.logger(msg, { success: true });
      } else if (btnBuyText === '立即申购') {
        this.startPay(timer, () => rush.business.doGoRush(2))
        this.logger(msg, { success: true });
      } else if (btnBuyText === '即将开始') {
        msg = `抢购还未开始，持续监听中, 已监听 ${++i} 次`
        this.logger(msg);
      }
    },
    startPay(timer, next = () => { }) {
      clearInterval(timer);

      // 改为0.5s提交一次订单 防止提交频繁警告
      const timer2 = setInterval(() => {
        next()
      }, 500)

      // 30s后停止提交订单
      setTimeout(() => {
        clearInterval(timer2);
      }, 1000 * 30)
    },
    submitOrder(timer) {
      clearInterval(timer);
      this.logger('订单页面注入成功, 等待提交...')

      let index = 0;
      const timer2 = setInterval(() => {
        if ($('.system-error-area .vam').text().indexOf('商城火爆销售中') > -1) {
          this.logger('提交失败, 请返回商品页重试', { error: true })
          return
        }

        try {
          if (ec.order.myAddress?.noAddressFlag && 14 != $("#orderType").val() && 28 != $("#orderType").val() && 36 != $("#orderType").val() && 35 != $("#orderType").val()) {
            this.notify('提交失败, 未设置默认地址', 'warn')
          }

          if (ec.deliveryChooser?.result) {
            if ($("#order-confirm-form input[name=appointDelMsg]").length < 1) {
              $("#order-confirm-form").append('<input name="appointDelMsg" type="hidden" value="">')
            }
            $("#order-confirm-form input[name=appointDelMsg]").val(JSON.stringify(ec.deliveryChooser.result))
          }
          ec.order?.confirmSubmit?.()
        } catch (error) {
          // 函数调用失败时, 使用降级模式提交订单
          this.logger('函数调用失败, 尝试使用降级模式提交订单', { error: true })
          $('a:contains("提交订单")').click()
        }
        this.logger(`开始提交订单, 已提交 ${++index} 次`, { success: true })
      }, 200)

      // 300s后停止提交订单
      setTimeout(() => {
        clearInterval(timer2);
        this.logger(`距离抢购开始已经5分钟, 停止提交, 下次再接再厉哦!`, { error: true })
      }, 1000 * 300)
    },
    logger(message, { error, success } = {}) {
      console.info(message);
      if (this.logs.length >= 2000) {
        this.logs.splice(2000)
      }
      this.logs.unshift({
        message: `[${new Date().toLocaleString()}] ${message}`,
        error,
        success
      })
      // GM_setValue('logs', this.logs)
    },
    notify(message, type = 'info') {
      console.warn(message);

      // ELEMENT.Notification.closeAll()
      ELEMENT.Notification[type]({
        title: '抢购提示',
        message,
      })
    }
  }

  const pluginInstance = new Vue({
    template: '#pluginApp-template',
    data,
    computed,
    watch,
    ...hooks,
    methods
  }).$mount('#pluginApp')

  // vue-devtools
  const instanceDiv = document.createElement('div')
  instanceDiv.__vue__ = pluginInstance
  document.body.appendChild(instanceDiv)
}
