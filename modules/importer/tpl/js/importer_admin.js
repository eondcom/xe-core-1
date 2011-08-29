/**
 * @file   modules/importer/js/importer_admin.js
 * @author NHN (developers@xpressengine.com)
 * @brief  importer에서 사용하는 javascript
 **/
jQuery(function($){

// Note : Module finder is defined modules/admin/tpl/js/admin.js

// Check whether the xml file exists
$('.checkxml')
	.find('input:text')
		.change(function(){
			$(this).closest('.checkxml').find('.desc').hide();
		})
	.end()
	.find('button')
		.click(function(){
			var $this, $container, $input, $messages, $loading, $form, count;

			$this      = $(this).prop('disabled', true);
			$form      = $this.closest('form');
			$container = $this.closest('.checkxml');
			$input     = $container.find('input').prop('disabled', true).addClass('loading');
			$messages  = $container.find('.desc').hide();

			function on_complete(data) {
				var $ul, $ttxml, $xml;

				$ul    = $this.closest('ul');
				$xml   = $ul.find('>.xml');
				$ttxml = $ul.find('>.ttxml');
					
				// when the file doesn't exists or any other error occurs
				if(data.error || data.exists != 'true') {
					$messages.filter('.error').fadeIn(300);
					$ttxml = $ttxml.filter(':visible');
					$ttxml.eq(-1).slideUp(100, function(){
						$ttxml = $ttxml.slice(0,-1).eq(-1).slideUp(100,arguments.callee);
					});
					$form.find(':submit').attr('disabled','disabled');
					return restore();
				}

				restore();
				$messages.filter('.success').fadeIn(300);
				$form.find(':submit').removeAttr('disabled');
				
				if(data.type == 'XML') {
					$ttxml = $ttxml.filter(':visible:not(.xml)');
					$ttxml.eq(-1).slideUp(100, function(){
						$ttxml = $ttxml.slice(0,-1).eq(-1).slideUp(100,arguments.callee);
					});
					if(!$xml.is(':visible')) $xml.slideDown(300);
				} else if(data.type == 'TTXML') {
					$ttxml = $ttxml.not(':visible');
					$ttxml.eq(0).slideDown(100, function(){
						$ttxml = $ttxml.slice(1).eq(0).slideDown(100,arguments.callee);
					});
				}
			};

			function restore() {
				$input.prop('disabled', false).removeClass('loading');
				$this.prop('disabled', false);
				return false;
			};

			show_waiting_message = false;
			$.exec_json('importer.procImporterAdminCheckXmlFile', {filename:$.trim($input.val())}, on_complete);
		})
	.end()
	.find('.desc').hide().end()
	.closest('ul').find('>li.ttxml').hide().end().end()
	.closest('form').find(':submit').attr('disabled','disabled');

});

/**
 * 회원정보와 게시글/댓글등의 동기화 요청 및 결과 처리 함수
 **/
function doSync(fo_obj) {
    exec_xml(
		'importer',
		'procImporterAdminSync', 
		[],
		function(ret){
			alert(ret.message);
			location.href = location.href;
		}
	);
    return false;
}

/**
 * xml파일을 DB입력전에 extract를 통해 분할 캐싱을 요청하는 함수
 **/
function doPreProcessing(form) {
	var xml_file, type, resp, prepared = false, $ = jQuery, $status, $process, $form;

	xml_file = form.elements['xml_file'].value;
	type     = form.elements['type'].value;

    if(!xml_file) return false;

	$form    = $('#importForm').hide();
	$process = $('#process').show();
	$status  = $('#status').empty();

	// display dots while preparing
	(function(){
		if(prepared) return;

		var str = $status.html();
		(!str.length || str.length - preProcessingMsg.length > 50)?str=preProcessingMsg:str+='.';

		$status.html(str);
		
		setTimeout(arguments.callee, 50);
	})();

    setTimeout(doPrepareDot, 50);

	function on_complete(ret) {
		var $reload, $cont, fo_proc, fo_import, elems, i, c, key, to_copy;

		prepared = true;
		$status.empty();

		$reload = $('#btn_reload');
		$cont   = $('#btn_continue');

		if(ret.status == -1) {
			$form.show();
			$reload.show();
			$process.hide();
			$cont.hide();
			return alert(ret.message);
		}

		$reload.hide();
		$cont.show();

		fo_proc = get_by_id('fo_process');
		elems   = fo_proc.elements;

		for(i=0,c=resp.length; i < c; i++) {
			key = resp[i];
			elems[key]?elems[key].value=ret[key]:0;
		}

		fo_import = get_by_id('fo_import');
		if(fo_import) {
			to_copy = ['target_module','guestbook_target_module','user_id', 'unit_count'];
			for(i=0,c=to_copy.length; i < c; i++) {
				key = to_copy[i];
				if(fo_import.elements[key]) fo_proc.elements[key].value = fo_import.elements[key].value;
			}
		}

		doImport();
	}

    exec_xml(
		'importer', // module
		'procImporterAdminPreProcessing', // action
		{type:type, xml_file:xml_file}, // parameters
		on_complete, // callback
		resp=['error','message','type','total','cur','key','status'] // response tags
	);

    return false;
}

/* @brief Start importing */
function doImport() {
    var form = get_by_id('fo_process'), elems = form.elements, i, c, params={}, resp;

	for(i=0,c=elems.length; i < c; i++) {
		params[elems[i].name] = elems[i].value;
	}

    displayProgress(params.total, params.cur);

	function on_complete(ret, response_tags) {
		var i, c, key;
		
		for(i=0,c=resp.length; i < c; i++) {
			key = resp[i];
			elems[key]?elems[key].value=ret_obj[key]:0;
		}

		ret.total = parseInt(ret.total, 10) || 0;
		ret.cur   = parseInt(ret.cur, 10) || 0;

		if(ret.total > ret.cur) {
			doImport();
		} else {
			alert(ret.message);
			try {
				form.reset();
				get_by_id('fo_import').reset();
				jQuery('#process').hide();
				jQuery('#importForm').show();
			} catch(e){};
		}
	}

    show_waiting_message = false;
    exec_xml(
		'importer', // module
		'procImporterAdminImport', // act
		params,
		on_complete, // callback
		resp = ['error','message','type','total','cur','key'] // response tags
	);
    show_waiting_message = true;

    return false;
}

/* display progress */
function displayProgress(total, cur) {
	var per, stat, $stat;

	per = Math.max(total?Math.round(cur/total*100):100, 1);

	$stat = jQuery('#status');
	if(!$stat.find('div.progress1').length) {
		$stat.html( '<div class="progressBox"><div class="progress1"></div><div class="progress2"></div><div class="clear"></div></div>' );
	}

	$stat
		.find('div.progress1')
			.html(per+'&nbsp;')
			.css('width', per+'%')
		.end()
		.find('div.progress2')
			.text(cur+'/'+total);
}

function insertSelectedModule(id, module_srl, mid, browser_title) {
	get_by_id(id).value = module_srl;
	get_by_id('_'+id).value = browser_title + ' ('+mid+')';
}

var currentClickedObject = null;
var currentClickedSiteObject = null;
jQuery(function($){

$('a.findsite')
	.bind('before-open.tc', function(){
		var $this = $(this), $layer = $($this.attr('href')), $ul = $layer.find('>ul'), $button;
		currentClickedObject = $this;
		var searchKeyword = $this.prev('input[name=site_keyword]').val();
		var params = new Array();
		var response_tags = ['error', 'message', 'site_list'];
		params['domain'] = searchKeyword; 
    	exec_xml('admin','getSiteAllList',params, completeGetSiteAllList, response_tags);
	});

$('div.suggestion')
	.delegate('button', 'click', function(){
		var $this = $(this), site_srl = $this.data('site_srl');
		currentClickedSiteObject = $this;

		// TODO : 모듈 목록을 찾아서 셀렉트 박스에 할당
		var params = new Array();
		var response_tags = ['error', 'message', 'module_list'];
		params['site_srl'] = site_srl;

		exec_xml('module','procModuleAdminGetList',params, completeGetModuleList, response_tags);
	});

$('select.moduleList').change(function(){
		alert(this);
	});

});

xe.siteAllList = [];

function completeGetSiteAllList(ret_obj)
{
	if(!jQuery.isArray(ret_obj['site_list']['item'])) xe.siteAllList = [ret_obj['site_list']['item']];
	else xe.siteAllList = ret_obj['site_list']['item'];

	var $layer = jQuery(currentClickedObject.attr('href')), $ul = $layer.find('>ul'), $button;
		$ul.empty();
		for(var i=0,c=xe.siteAllList.length; i < c; i++) {
			$button = jQuery('<button type="button">'+xe.siteAllList[i].domain+'</button>');
			$button.data('domain', xe.siteAllList[i].domain).data('site_srl', xe.siteAllList[i].site_srl);

			jQuery('<li>').append($button).appendTo($ul);
		}
}

var module_list = '';
function completeGetModuleList(ret_obj, response_tags)
{
	module_list = ret_obj['module_list'];
	var htmlListBuffer = '';

	for(var x in module_list)
	{
		if(x == 'page') continue;
		var moduleObject = module_list[x];
		htmlListBuffer += '<option value="'+x+'">'+moduleObject.title+'</option>';
	}
	currentClickedSiteObject.parents('li').find('select:first').html(htmlListBuffer).prop('selectedIndex', 0).change();
	//makeMidList(jQuery('#module_list').val());
}

/*jQuery(document).ready(function($){
	$('#module_list').bind('change', function(e){
		makeMidList($('#module_list').val());
	});
	$('#mid_list').bind('change', function(e){
		doGetCategoryFromModule($('#mid_list').val());
	});
});*/

function makeMidList(moduleName)
{
	var mid_list = module_list[moduleName].list;
	var htmlListBuffer = '';
	for(var x in mid_list)
	{
		var moduleInstance = mid_list[x];
		htmlListBuffer += '<option value="'+moduleInstance.module_srl+'">'+x+'</option>';
	}
	jQuery('#mid_list').html(htmlListBuffer);
	doGetCategoryFromModule(jQuery('#mid_list').val());
}
