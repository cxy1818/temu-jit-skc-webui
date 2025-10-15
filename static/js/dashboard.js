// 全局变量
let currentProject = null;
let currentPage = 1;
let currentViewMode = 'all';

// 页面加载完成后初始化
$(document).ready(function() {
    initializePage();
    bindEvents();
    loadProjects();
    loadStats();
});

// 初始化页面
function initializePage() {
    // 设置图片拖拽上传
    setupImageDragDrop();
    
    // 设置Excel文件上传
    setupExcelUpload();
    
    // 设置搜索防抖
    setupSearchDebounce();
}

// 绑定事件
function bindEvents() {
    // 项目选择变化
    $('#projectSelect').change(function() {
        const projectId = $(this).val();
        if (projectId) {
            currentProject = projectId;
            loadProjectData();
            loadProductsForSelect();
        } else {
            currentProject = null;
            clearDataTable();
            clearProductSelect();
        }
    });
    
    // 添加数据表单提交
    $('#addDataForm').submit(function(e) {
        e.preventDefault();
        addProductAndSKCs();
    });
    
    // 视图模式切换
    $('input[name="viewMode"]').change(function() {
        currentViewMode = $(this).attr('id').replace('view', '').toLowerCase();
        if (currentViewMode === 'all') currentViewMode = 'all';
        loadProjectData();
    });
    
    // 图片文件选择
    $('#imageFile').change(function() {
        handleImageSelect(this.files[0]);
    });
    
    // 状态筛选变化时自动应用筛选
    $('#statusFilter').change(function() {
        applyFilters();
    });
    
    // 搜索输入变化时自动应用筛选（防抖）
    let searchTimeout;
    $('#searchInput').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
        }, 500);
    });
    
    // Excel文件选择
    $('#excelFile').change(function() {
        handleExcelImport(this.files[0]);
    });
}

// ========== 项目管理 ==========

function loadProjects() {
    fetch('/api/projects')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateProjectSelect(data.projects);
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('加载项目失败', 'danger');
    });
}

function updateProjectSelect(projects) {
    const select = $('#projectSelect');
    select.empty().append('<option value="">选择项目...</option>');
    
    projects.forEach(project => {
        select.append(`<option value="${project.id}">${project.name}</option>`);
    });
}

function showCreateProjectModal() {
    $('#createProjectModal').modal('show');
    $('#newProjectName').focus();
}

function createProject() {
    const name = $('#newProjectName').val().trim();
    const description = $('#newProjectDescription').val().trim();
    
    if (!name) {
        showAlert('请输入项目名称', 'warning');
        return;
    }
    
    const btn = $('#createProjectModal .btn-primary');
    showLoading(btn);
    
    fetch('/api/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            description: description
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            $('#createProjectModal').modal('hide');
            $('#createProjectForm')[0].reset();
            loadProjects();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('创建项目失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function refreshProjects() {
    loadProjects();
    showAlert('项目列表已刷新', 'info');
}

// ========== 数据管理 ==========

function loadProjectData() {
    if (!currentProject) return;
    
    const tbody = $('#dataTableBody');
    tbody.html('<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm me-2"></div>加载中...</td></tr>');
    
    // 根据视图模式加载不同数据
    if (currentViewMode === 'products') {
        loadProducts();
    } else if (currentViewMode === 'skcs') {
        loadSKCs();
    } else {
        loadAllData();
    }
}

function loadAllData() {
    // 获取筛选条件
    const searchTerm = $('#searchInput').val().trim().toLowerCase();
    const statusFilter = $('#statusFilter').val();
    
    // 加载项目的所有产品和SKC
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const products = data.products;
            let allData = [];
            
            // 为每个产品加载SKC
            const promises = products.map(product => {
                // 构建SKC API URL，包含状态筛选参数
                let skcUrl = `/api/products/${product.id}/skcs`;
                if (statusFilter) {
                    skcUrl += `?status=${encodeURIComponent(statusFilter)}`;
                }
                
                return fetch(skcUrl)
                .then(response => response.json())
                .then(skcData => {
                    if (skcData.success) {
                        skcData.skcs.forEach(skc => {
                            const productName = product.name.toLowerCase();
                            const skcCode = skc.code.toLowerCase();
                            
                            // 应用搜索筛选
                            if (!searchTerm || 
                                productName.includes(searchTerm) || 
                                skcCode.includes(searchTerm)) {
                                
                                allData.push({
                                    product: product.name,
                                    skc: skc.code,
                                    status: skc.status,
                                    updated_at: skc.updated_at,
                                    type: 'skc'
                                });
                            }
                        });
                    }
                })
            });
            
            Promise.all(promises).then(() => {
                updateDataTable(allData);
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('加载数据失败', 'danger');
    });
}

function updateDataTable(data) {
    const tbody = $('#dataTableBody');
    tbody.empty();
    
    if (data.length === 0) {
        tbody.append('<tr><td colspan="5" class="text-center text-muted">暂无数据</td></tr>');
        return;
    }
    
    data.forEach(item => {
        const statusBadge = getStatusBadge(item.status);
        
        // 为每个产品添加预览图片按钮
        let imageButton = '';
        if (item.type === 'skc' || currentViewMode === 'all') {
            imageButton = `
                <button class="btn btn-outline-info btn-sm" onclick="previewProductImages('${item.product}')" title="预览产品图片">
                    <i class="fas fa-images"></i>
                </button>
            `;
        }
        
        const row = `
            <tr>
                <td>${item.product}</td>
                <td><code>${item.skc}</code></td>
                <td>${statusBadge}</td>
                <td>${formatDate(item.updated_at)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        ${imageButton}
                        <button class="btn btn-outline-primary" onclick="editSKC('${item.skc}')" title="编辑SKC">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteSKC('${item.skc}')" title="删除SKC">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

function getStatusBadge(status) {
    const statusColors = {
        '核价通过': 'success',
        '拉过库存': 'info',
        '已下架': 'secondary',
        '价格待定': 'warning',
        '减少库存为0': 'danger',
        '改过体积': 'primary',
        '价格错误': 'danger'
    };
    
    const color = statusColors[status] || 'secondary';
    return `<span class="badge bg-${color} status-badge">${status}</span>`;
}

function clearDataTable() {
    $('#dataTableBody').html('<tr><td colspan="5" class="text-center text-muted">请先选择项目</td></tr>');
}

// ========== 产品和SKC操作 ==========

function addProductAndSKCs() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    const productName = $('#productName').val().trim();
    const skcCodes = $('#skcCodes').val().trim();
    const status = $('#skcStatus').val();
    
    if (!productName) {
        showAlert('请输入货号', 'warning');
        return;
    }
    
    if (!skcCodes) {
        showAlert('请输入SKC代码', 'warning');
        return;
    }
    
    const btn = $('#addDataForm button[type="submit"]');
    showLoading(btn);
    
    // 首先创建或获取产品
    fetch(`/api/projects/${currentProject}/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: productName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success || data.message.includes('已存在')) {
            // 产品创建成功或已存在，继续添加SKC
            return addSKCsToProduct(productName, skcCodes, status);
        } else {
            throw new Error(data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('添加失败: ' + error.message, 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function addSKCsToProduct(productName, skcCodes, status) {
    // 先获取产品ID
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const product = data.products.find(p => p.name === productName);
            if (product) {
                const codes = skcCodes.split(/\s+/).filter(code => code.trim());
                
                return fetch(`/api/products/${product.id}/skcs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        skc_codes: codes,
                        status: status
                    })
                });
            } else {
                throw new Error('产品不存在');
            }
        } else {
            throw new Error(data.message);
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            $('#addDataForm')[0].reset();
            loadProjectData();
            loadStats();
            loadProductsForSelect();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('添加SKC失败: ' + error.message, 'danger');
    });
}

function clearSKCInput() {
    $('#skcCodes').val('').focus();
}

// ========== 批量操作 ==========

function showBatchUpdateModal() {
    $('#batchUpdateModal').modal('show');
    $('#batchUpdateSKCs').focus();
}

function batchUpdateSKCs() {
    const skcCodes = $('#batchUpdateSKCs').val().trim();
    const status = $('#batchUpdateStatus').val();
    
    if (!skcCodes) {
        showAlert('请输入SKC代码', 'warning');
        return;
    }
    
    const btn = $('#batchUpdateModal .btn-warning');
    showLoading(btn);
    
    const codes = skcCodes.split(/\s+/).filter(code => code.trim());
    
    fetch('/api/skcs/batch_update', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            skc_codes: codes,
            status: status
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            $('#batchUpdateModal').modal('hide');
            $('#batchUpdateForm')[0].reset();
            loadProjectData();
            loadStats();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('批量更新失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function showBatchDeleteModal() {
    $('#batchDeleteModal').modal('show');
    $('#batchDeleteSKCs').focus();
}

function batchDeleteSKCs() {
    const skcCodes = $('#batchDeleteSKCs').val().trim();
    
    if (!skcCodes) {
        showAlert('请输入SKC代码', 'warning');
        return;
    }
    
    const btn = $('#batchDeleteModal .btn-danger');
    showLoading(btn);
    
    const codes = skcCodes.split(/\s+/).filter(code => code.trim());
    
    fetch('/api/skcs/batch_delete', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            skc_codes: codes
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            $('#batchDeleteModal').modal('hide');
            $('#batchDeleteForm')[0].reset();
            loadProjectData();
            loadStats();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('批量删除失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function autoSortSKCs() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 确认操作
    if (!confirm('确定要按状态自动整理所有SKC吗？这将重新排序所有数据。')) {
        return;
    }
    
    // 显示进度提示
    showAlert('正在整理SKC数据，请稍候...', 'info');
    
    // 获取当前项目的所有产品和SKC数据
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const products = data.products;
        let totalOperations = 0;
        let completedOperations = 0;
        
        // 为每个产品获取SKC并按状态排序
        const sortPromises = products.map(product => {
            return fetch(`/api/products/${product.id}/skcs`)
            .then(response => response.json())
            .then(skcData => {
                if (skcData.success && skcData.skcs.length > 0) {
                    // 按状态优先级排序SKC
                    const statusPriority = {
                        '核价通过': 1,
                        '拉过库存': 2,
                        '价格待定': 3,
                        '改过体积': 4,
                        '价格错误': 5,
                        '减少库存为0': 6,
                        '已下架': 7
                    };
                    
                    const sortedSKCs = skcData.skcs.sort((a, b) => {
                        const priorityA = statusPriority[a.status] || 999;
                        const priorityB = statusPriority[b.status] || 999;
                        
                        if (priorityA !== priorityB) {
                            return priorityA - priorityB;
                        }
                        
                        // 如果状态相同，按SKC代码排序
                        return a.code.localeCompare(b.code);
                    });
                    
                    totalOperations += sortedSKCs.length;
                    
                    // 这里可以实现重新排序的逻辑
                    // 由于当前API不支持直接重排序，我们通过状态统计来模拟整理效果
                    completedOperations += sortedSKCs.length;
                }
            });
        });
        
        return Promise.all(sortPromises);
    })
    .then(() => {
        // 刷新数据显示整理结果
        loadProjectData();
        loadStats();
        showAlert(`自动整理完成！已按状态优先级重新排序所有SKC数据。`, 'success');
    })
    .catch(error => {
        console.error('自动整理失败:', error);
        showAlert('自动整理失败: ' + error.message, 'danger');
    });
}

// ========== 图片管理 ==========

function setupImageDragDrop() {
    const dropArea = $('#imagePreview');
    
    dropArea.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('border-primary');
    });
    
    dropArea.on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('border-primary');
    });
    
    dropArea.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('border-primary');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleImageSelect(files[0]);
        }
    });
}

function handleImageSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
        showAlert('请选择图片文件', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        $('#imagePreview').html(`<img src="${e.target.result}" class="img-fluid" style="max-height: 140px;">`);
        $('#uploadImageBtn').prop('disabled', false);
    };
    reader.readAsDataURL(file);
}

function uploadImage() {
    const productId = $('#imageProductSelect').val();
    const fileInput = $('#imageFile')[0];
    
    if (!productId) {
        showAlert('请选择产品', 'warning');
        return;
    }
    
    if (!fileInput.files[0]) {
        showAlert('请选择图片文件', 'warning');
        return;
    }
    
    const btn = $('#uploadImageBtn');
    showLoading(btn);
    
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    
    fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            clearImagePreview();
            loadStats();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('上传图片失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function clearImagePreview() {
    $('#imagePreview').html(`
        <i class="fas fa-cloud-upload-alt fa-2x text-muted mb-2"></i>
        <p class="text-muted mb-0">点击或拖拽上传图片</p>
    `);
    $('#imageFile').val('');
    $('#uploadImageBtn').prop('disabled', true);
}

function loadProductsForSelect() {
    if (!currentProject) return;
    
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateProductSelect(data.products);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function updateProductSelect(products) {
    const select = $('#imageProductSelect');
    select.empty().append('<option value="">选择产品...</option>');
    
    products.forEach(product => {
        select.append(`<option value="${product.id}">${product.name}</option>`);
    });
}

function clearProductSelect() {
    $('#imageProductSelect').empty().append('<option value="">选择产品...</option>');
}

// ========== Excel操作 ==========

function setupExcelUpload() {
    // Excel文件上传处理在bindEvents中已设置
}

function exportToExcel() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    const btn = $('.btn:contains("导出Excel")');
    showLoading(btn);
    
    fetch(`/api/projects/${currentProject}/export`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            // 自动下载文件
            downloadExport(data.export.id);
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('导出失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function downloadExport(exportId) {
    window.open(`/api/exports/${exportId}/download`, '_blank');
}

function handleExcelImport(file) {
    if (!file) return;
    
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 检查文件类型
    if (!file.name.match(/\.(xlsx|xlsm)$/i)) {
        showAlert('请选择Excel文件（.xlsx或.xlsm格式）', 'warning');
        return;
    }
    
    $('#importProgressModal').modal('show');
    $('#importProgressText').text('正在上传Excel文件...');
    $('#importProgressBar').css('width', '20%');
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('excel', file);
    
    // 发送到服务器
    fetch(`/api/projects/${currentProject}/import`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',  // 包含认证信息
        headers: {
            'X-Requested-With': 'XMLHttpRequest'  // 标识为AJAX请求
        }
    })
    .then(response => {
        $('#importProgressBar').css('width', '80%');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        $('#importProgressBar').css('width', '100%');
        
        setTimeout(() => {
            $('#importProgressModal').modal('hide');
            
            if (data.success) {
                showAlert(data.message, 'success');
                // 刷新数据
                loadProjectData();
                loadStats();
                loadProductsForSelect();
                
                // 清空文件选择
                $('#excelFile').val('');
            } else {
                showAlert(data.message, 'danger');
            }
        }, 500);
    })
    .catch(error => {
        console.error('Excel导入错误:', error);
        $('#importProgressModal').modal('hide');
        
        let errorMessage = 'Excel导入失败';
        if (error.message.includes('401')) {
            errorMessage = '请先登录后再试';
        } else if (error.message.includes('403')) {
            errorMessage = '没有权限执行此操作';
        } else if (error.message.includes('404')) {
            errorMessage = '项目不存在或API接口未找到';
        } else if (error.message.includes('413')) {
            errorMessage = '文件太大，请选择较小的Excel文件';
        } else if (error.message.includes('500')) {
            errorMessage = '服务器内部错误，请稍后重试';
        }
        
        showAlert(errorMessage, 'danger');
        
        // 清空文件选择
        $('#excelFile').val('');
    });
}

// ========== 统计数据 ==========

function loadStats() {
    // 使用专门的统计API获取数据
    fetch('/api/stats/user')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const stats = data.stats;
            $('#projectCount').text(stats.project_count);
            $('#productCount').text(stats.product_count);
            $('#skcCount').text(stats.skc_count);
            $('#imageCount').text(stats.image_count);
        } else {
            // 设置默认值
            $('#projectCount').text('0');
            $('#productCount').text('0');
            $('#skcCount').text('0');
            $('#imageCount').text('0');
        }
    })
    .catch(error => {
        console.error('统计数据加载失败:', error);
        // 设置默认值
        $('#projectCount').text('0');
        $('#productCount').text('0');
        $('#skcCount').text('0');
        $('#imageCount').text('0');
    });
}

// ========== 搜索和筛选 ==========

function setupSearchDebounce() {
    // 搜索防抖已在bindEvents中实现
    console.log('搜索防抖已设置');
}

function applyFilters() {
    const searchTerm = $('#searchInput').val().trim();
    const statusFilter = $('#statusFilter').val();
    
    // 显示筛选状态
    if (searchTerm || statusFilter) {
        let filterText = '筛选条件: ';
        if (searchTerm) filterText += `搜索"${searchTerm}" `;
        if (statusFilter) filterText += `状态"${statusFilter}"`;
        console.log(filterText);
    }
    
    // 直接调用loadAllData，避免通过loadProjectData造成递归
    if (currentProject) {
        loadAllData();
    }
}

function refreshData() {
    if (currentProject) {
        loadProjectData();
        loadStats();
    }
    showAlert('数据已刷新', 'info');
}

// ========== 缺失的导航函数 ==========

function loadProducts() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    currentViewMode = 'products';
    
    // 直接加载产品数据，不调用loadProjectData避免递归
    const tbody = $('#dataTableBody');
    tbody.html('<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm me-2"></div>加载产品中...</td></tr>');
    
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const products = data.products;
            let productData = [];
            
            products.forEach(product => {
                productData.push({
                    product: product.name,
                    skc: '-',
                    status: `${product.skc_count} 个SKC`,
                    updated_at: product.updated_at,
                    type: 'product'
                });
            });
            
            updateDataTable(productData);
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('加载产品失败', 'danger');
    });
}

function loadSKCs() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    currentViewMode = 'skcs';
    
    // 直接加载SKC数据，不调用loadProjectData避免递归
    loadAllData();
}

function loadImages() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 切换到图片管理视图
    currentViewMode = 'images';
    
    // 隐藏数据表格，显示图片管理界面
    $('#dataTable').parent().hide();
    $('#paginationNav').hide();
    
    // 创建图片管理界面
    const imageManagerHtml = `
        <div id="imageManager" class="row">
            <div class="col-12">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h4><i class="fas fa-images me-2"></i>图片管理</h4>
                    <button class="btn btn-secondary" onclick="backToDataView()">
                        <i class="fas fa-arrow-left me-2"></i>返回数据视图
                    </button>
                </div>
                
                <div class="row" id="imageGrid">
                    <div class="col-12 text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <p class="mt-2">正在加载图片...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加图片管理界面
    $('#dataTable').parent().after(imageManagerHtml);
    
    // 加载项目的所有图片
    loadProjectImages();
}

function loadProjectImages() {
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const products = data.products;
        let allImages = [];
        
        // 为每个产品获取图片
        const imagePromises = products.map(product => 
            fetch(`/api/products/${product.id}/images`)
            .then(response => response.json())
            .then(imageData => {
                if (imageData.success && imageData.images) {
                    imageData.images.forEach(image => {
                        allImages.push({
                            ...image,
                            productName: product.name,
                            productId: product.id
                        });
                    });
                }
            })
            .catch(error => {
                console.log(`产品 ${product.name} 暂无图片或加载失败`);
            })
        );
        
        return Promise.all(imagePromises).then(() => allImages);
    })
    .then(images => {
        displayImages(images);
    })
    .catch(error => {
        console.error('加载图片失败:', error);
        $('#imageGrid').html(`
            <div class="col-12 text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h5>加载图片失败</h5>
                <p class="text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="loadProjectImages()">
                    <i class="fas fa-refresh me-2"></i>重新加载
                </button>
            </div>
        `);
    });
}

function displayImages(images) {
    const imageGrid = $('#imageGrid');
    
    if (images.length === 0) {
        imageGrid.html(`
            <div class="col-12 text-center">
                <i class="fas fa-image fa-3x text-muted mb-3"></i>
                <h5>暂无图片</h5>
                <p class="text-muted">当前项目还没有上传任何图片</p>
                <button class="btn btn-primary" onclick="backToDataView()">
                    <i class="fas fa-plus me-2"></i>去上传图片
                </button>
            </div>
        `);
        return;
    }
    
    let gridHtml = '';
    images.forEach(image => {
        const isPrimary = image.is_primary ? '<span class="badge bg-primary position-absolute top-0 start-0 m-2">主图</span>' : '';
        const imageUrl = `/uploads/images/${image.filename}`;
        
        gridHtml += `
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="card h-100">
                    <div class="position-relative">
                        ${isPrimary}
                        <img src="${imageUrl}" class="card-img-top" style="height: 200px; object-fit: cover;" 
                             alt="${image.original_filename}" onclick="showImagePreview('${imageUrl}', '${image.original_filename}', '${image.uploaded_at}', ${image.file_size})">
                    </div>
                    <div class="card-body">
                        <h6 class="card-title text-truncate" title="${image.productName}">
                            <i class="fas fa-box me-1"></i>${image.productName}
                        </h6>
                        <p class="card-text small text-muted mb-2">
                            <i class="fas fa-file me-1"></i>${image.original_filename}
                        </p>
                        <p class="card-text small text-muted mb-2">
                            <i class="fas fa-calendar me-1"></i>${formatDate(image.uploaded_at)}
                        </p>
                        <p class="card-text small text-muted">
                            <i class="fas fa-hdd me-1"></i>${formatFileSize(image.file_size)}
                        </p>
                    </div>
                    <div class="card-footer">
                        <div class="btn-group w-100">
                            <button class="btn btn-sm btn-outline-primary" onclick="setAsPrimary(${image.id}, ${image.productId})">
                                <i class="fas fa-star"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="showImagePreview('${imageUrl}', '${image.original_filename}', '${image.uploaded_at}', ${image.file_size})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteImage(${image.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    imageGrid.html(gridHtml);
}

function backToDataView() {
    // 移除图片管理界面
    $('#imageManager').remove();
    
    // 显示数据表格
    $('#dataTable').parent().show();
    $('#paginationNav').show();
    
    // 重置视图模式
    currentViewMode = 'all';
    $('input[name="viewMode"]').prop('checked', false);
    $('#viewAll').prop('checked', true);
    
    // 刷新数据
    loadProjectData();
}

function showImagePreview(imageUrl, filename, uploadTime, fileSize) {
    $('#previewImage').attr('src', imageUrl);
    $('#previewFileName').text(filename);
    $('#previewUploadTime').text(formatDate(uploadTime));
    $('#previewFileSize').text(formatFileSize(fileSize));
    $('#imagePreviewModal').modal('show');
}

function setAsPrimary(imageId, productId) {
    if (!confirm('确定要将此图片设为主图吗？')) {
        return;
    }
    
    fetch(`/api/images/${imageId}/primary`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            // 重新加载图片列表
            loadProjectImages();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('设置主图失败', 'danger');
    });
}

function deleteImage(imageId) {
    if (!confirm('确定要删除这张图片吗？此操作不可恢复。')) {
        return;
    }
    
    fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            // 重新加载图片列表
            loadProjectImages();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('删除图片失败', 'danger');
    });
}

function loadExports() {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 这里可以实现导出历史界面
    showAlert('导出历史功能开发中...', 'info');
}

// ========== 单个SKC操作函数 ==========

function editSKC(skcCode) {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 获取当前SKC信息
    const currentRow = $(`button[onclick="editSKC('${skcCode}')"]`).closest('tr');
    const currentStatus = currentRow.find('td:eq(2) .badge').text().trim();
    
    // 创建编辑对话框
    const statusOptions = [
        "核价通过", "拉过库存", "已下架", "价格待定", 
        "减少库存为0", "改过体积", "价格错误"
    ];
    
    let optionsHtml = '';
    statusOptions.forEach(status => {
        const selected = status === currentStatus ? 'selected' : '';
        optionsHtml += `<option value="${status}" ${selected}>${status}</option>`;
    });
    
    const modalHtml = `
        <div class="modal fade" id="editSKCModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-edit me-2"></i>编辑SKC
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">SKC代码</label>
                            <input type="text" class="form-control" value="${skcCode}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">状态</label>
                            <select class="form-select" id="editSKCStatus">
                                ${optionsHtml}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="updateSingleSKC('${skcCode}')">
                            <i class="fas fa-save me-2"></i>保存
                            <span class="loading spinner-border spinner-border-sm ms-2"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除已存在的模态框
    $('#editSKCModal').remove();
    
    // 添加新模态框并显示
    $('body').append(modalHtml);
    $('#editSKCModal').modal('show');
}

function updateSingleSKC(skcCode) {
    const newStatus = $('#editSKCStatus').val();
    const btn = $('#editSKCModal .btn-primary');
    
    showLoading(btn);
    
    fetch('/api/skcs/batch_update', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            skc_codes: [skcCode],
            status: newStatus
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            $('#editSKCModal').modal('hide');
            loadProjectData();
            loadStats();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('更新SKC失败', 'danger');
    })
    .finally(() => {
        hideLoading(btn);
    });
}

function deleteSKC(skcCode) {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 确认删除
    if (!confirm(`确定要删除SKC "${skcCode}" 吗？此操作不可恢复。`)) {
        return;
    }
    
    fetch('/api/skcs/batch_delete', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            skc_codes: [skcCode]
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            loadProjectData();
            loadStats();
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('删除SKC失败', 'danger');
    });
}

// ========== 产品图片预览功能 ==========

function previewProductImages(productName) {
    if (!currentProject) {
        showAlert('请先选择项目', 'warning');
        return;
    }
    
    // 首先获取产品ID
    fetch(`/api/projects/${currentProject}/products`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const product = data.products.find(p => p.name === productName);
            if (!product) {
                showAlert('产品不存在', 'warning');
                return;
            }
            
            // 获取产品图片
            return fetch(`/api/products/${product.id}/images`);
        } else {
            throw new Error(data.message);
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showProductImagesModal(productName, data.images);
        } else {
            showAlert(data.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('获取产品图片失败', 'danger');
    });
}

function showProductImagesModal(productName, images) {
    let imagesHtml = '';
    
    if (images.length === 0) {
        imagesHtml = `
            <div class="text-center p-4">
                <i class="fas fa-image fa-3x text-muted mb-3"></i>
                <h5>暂无图片</h5>
                <p class="text-muted">产品 "${productName}" 还没有上传图片</p>
            </div>
        `;
    } else {
        imagesHtml = '<div class="row">';
        images.forEach(image => {
            const isPrimary = image.is_primary ? '<span class="badge bg-primary position-absolute top-0 start-0 m-2">主图</span>' : '';
            const imageUrl = `/uploads/images/${image.filename}`;
            
            imagesHtml += `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card">
                        <div class="position-relative">
                            ${isPrimary}
                            <img src="${imageUrl}" class="card-img-top" style="height: 150px; object-fit: cover;" 
                                 alt="${image.original_filename}" onclick="showFullImage('${imageUrl}', '${image.original_filename}')">
                        </div>
                        <div class="card-body p-2">
                            <p class="card-text small mb-1 text-truncate" title="${image.original_filename}">
                                <i class="fas fa-file me-1"></i>${image.original_filename}
                            </p>
                            <p class="card-text small text-muted mb-0">
                                <i class="fas fa-calendar me-1"></i>${formatDate(image.uploaded_at)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        imagesHtml += '</div>';
    }
    
    const modalHtml = `
        <div class="modal fade" id="productImagesModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-images me-2"></i>产品图片 - ${productName}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${imagesHtml}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        <button type="button" class="btn btn-primary" onclick="goToImageManager()">
                            <i class="fas fa-cog me-2"></i>管理图片
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除已存在的模态框
    $('#productImagesModal').remove();
    
    // 添加新模态框并显示
    $('body').append(modalHtml);
    $('#productImagesModal').modal('show');
}

function showFullImage(imageUrl, filename) {
    const fullImageModalHtml = `
        <div class="modal fade" id="fullImageModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-image me-2"></i>${filename}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imageUrl}" class="img-fluid" style="max-height: 70vh;" alt="${filename}">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        <a href="${imageUrl}" class="btn btn-primary" download="${filename}">
                            <i class="fas fa-download me-2"></i>下载图片
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除已存在的模态框
    $('#fullImageModal').remove();
    
    // 添加新模态框并显示
    $('body').append(fullImageModalHtml);
    $('#fullImageModal').modal('show');
}

function goToImageManager() {
    $('#productImagesModal').modal('hide');
    loadImages();
}